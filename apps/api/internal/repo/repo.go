// Package repo is the data-access layer. All SQL lives here.
package repo

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound  = errors.New("not found")
	ErrForbidden = errors.New("forbidden")
	ErrConflict  = errors.New("conflict")
)

type Store struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

func (s *Store) Ping(ctx context.Context) error { return s.pool.Ping(ctx) }

// ------------------------------------------------------------------ users & auth

func (s *Store) CreateNonce(ctx context.Context, nonce string) error {
	_, err := s.pool.Exec(ctx, `INSERT INTO auth_nonces(nonce) VALUES ($1)`, nonce)
	return err
}

// ConsumeNonce deletes a fresh nonce and reports whether it existed (single use, 10 min TTL).
func (s *Store) ConsumeNonce(ctx context.Context, nonce string) (bool, error) {
	tag, err := s.pool.Exec(ctx,
		`DELETE FROM auth_nonces WHERE nonce=$1 AND created_at > now() - interval '10 minutes'`, nonce)
	if err != nil {
		return false, err
	}
	// Opportunistic cleanup of stale nonces.
	_, _ = s.pool.Exec(ctx, `DELETE FROM auth_nonces WHERE created_at < now() - interval '1 hour'`)
	return tag.RowsAffected() == 1, nil
}

func (s *Store) TouchUser(ctx context.Context, address string) error {
	_, err := s.pool.Exec(ctx, `INSERT INTO users(address) VALUES ($1)
		ON CONFLICT (address) DO UPDATE SET last_login_at = now()`, address)
	return err
}

func (s *Store) SetPublicKey(ctx context.Context, address, pub string) error {
	_, err := s.pool.Exec(ctx, `INSERT INTO users(address, public_key) VALUES ($1,$2)
		ON CONFLICT (address) DO UPDATE SET public_key = EXCLUDED.public_key`, address, pub)
	return err
}

func (s *Store) PublicKey(ctx context.Context, address string) (string, error) {
	var pk *string
	err := s.pool.QueryRow(ctx, `SELECT public_key FROM users WHERE address=$1`, address).Scan(&pk)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && pk == nil) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", err
	}
	return *pk, nil
}

// ------------------------------------------------------------------ sharing

type Grant struct {
	Address   string    `json:"address"`
	GrantedAt time.Time `json:"grantedAt"`
	HasKey    bool      `json:"hasPublicKey"`
}

func (s *Store) HasAccess(ctx context.Context, owner, viewer string) (bool, error) {
	if owner == viewer {
		return true, nil
	}
	var ok bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM access_grants WHERE owner=$1 AND viewer=$2)`, owner, viewer).Scan(&ok)
	return ok, err
}

func (s *Store) Viewers(ctx context.Context, owner string) ([]Grant, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT g.viewer, g.granted_at, u.public_key IS NOT NULL
		FROM access_grants g LEFT JOIN users u ON u.address = g.viewer
		WHERE g.owner=$1 ORDER BY g.granted_at DESC`, owner)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (Grant, error) {
		var g Grant
		err := r.Scan(&g.Address, &g.GrantedAt, &g.HasKey)
		return g, err
	})
}

type SharedOwner struct {
	Owner     string    `json:"owner"`
	FileCount int64     `json:"fileCount"`
	GrantedAt time.Time `json:"grantedAt"`
}

func (s *Store) SharedWithMe(ctx context.Context, viewer string) ([]SharedOwner, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT g.owner, g.granted_at,
		       (SELECT count(*) FROM files f WHERE f.owner = g.owner AND f.status = 'confirmed')
		FROM access_grants g WHERE g.viewer=$1 ORDER BY g.granted_at DESC`, viewer)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (SharedOwner, error) {
		var o SharedOwner
		err := r.Scan(&o.Owner, &o.GrantedAt, &o.FileCount)
		return o, err
	})
}

type WrappedKey struct {
	FileID     int64  `json:"fileId"`
	Recipient  string `json:"recipient"`
	WrappedKey string `json:"wrappedKey"`
}

// PutWrappedKeys stores per-recipient wrapped file keys. Rows for files the caller does not own
// are silently skipped. Returns how many were written.
func (s *Store) PutWrappedKeys(ctx context.Context, owner string, keys []WrappedKey) (int64, error) {
	batch := &pgx.Batch{}
	for _, k := range keys {
		batch.Queue(`
			INSERT INTO file_keys(file_id, recipient, wrapped_key)
			SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM files WHERE id=$1 AND owner=$4)
			ON CONFLICT (file_id, recipient) DO UPDATE SET wrapped_key = EXCLUDED.wrapped_key`,
			k.FileID, k.Recipient, k.WrappedKey, owner)
	}
	br := s.pool.SendBatch(ctx, batch)
	defer br.Close()
	var n int64
	for range keys {
		tag, err := br.Exec()
		if err != nil {
			return n, err
		}
		n += tag.RowsAffected()
	}
	return n, nil
}

// MissingKeys lists (fileId, recipient) pairs where an encrypted file of `owner` has no wrapped
// key for a current viewer with a registered public key. The client wraps and uploads them.
func (s *Store) MissingKeys(ctx context.Context, owner string) ([]WrappedKey, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT f.id, g.viewer
		FROM files f
		JOIN access_grants g ON g.owner = f.owner
		JOIN users u ON u.address = g.viewer AND u.public_key IS NOT NULL
		WHERE f.owner=$1 AND f.encrypted AND f.status <> 'removed'
		  AND NOT EXISTS (SELECT 1 FROM file_keys k WHERE k.file_id=f.id AND k.recipient=g.viewer)
		LIMIT 500`, owner)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (WrappedKey, error) {
		var k WrappedKey
		err := r.Scan(&k.FileID, &k.Recipient)
		return k, err
	})
}
