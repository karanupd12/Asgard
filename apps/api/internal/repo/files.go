package repo

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type File struct {
	ID          int64      `json:"id"`
	Owner       string     `json:"owner"`
	CID         string     `json:"cid"`
	ThumbCID    *string    `json:"thumbCid"`
	ChainFileID *int64     `json:"chainFileId"`
	Status      string     `json:"status"`
	Encrypted   bool       `json:"encrypted"`
	Title       string     `json:"title"`
	Mime        string     `json:"mime"`
	SizeBytes   int64      `json:"sizeBytes"`
	Width       *int32     `json:"width"`
	Height      *int32     `json:"height"`
	Tags        []string   `json:"tags"`
	TxHash      *string    `json:"txHash"`
	CreatedAt   time.Time  `json:"createdAt"`
	ConfirmedAt *time.Time `json:"confirmedAt"`
	// WrappedKey is the file key wrapped for the *requesting* user (encrypted files only).
	WrappedKey *string `json:"wrappedKey"`
}

const fileCols = `f.id, f.owner, f.cid, f.thumb_cid, f.chain_file_id, f.status, f.encrypted, f.title,
	f.mime, f.size_bytes, f.width, f.height, f.tags, f.tx_hash, f.created_at, f.confirmed_at`

func scanFile(row pgx.Row, withKey bool) (File, error) {
	var f File
	dest := []any{&f.ID, &f.Owner, &f.CID, &f.ThumbCID, &f.ChainFileID, &f.Status, &f.Encrypted,
		&f.Title, &f.Mime, &f.SizeBytes, &f.Width, &f.Height, &f.Tags, &f.TxHash, &f.CreatedAt, &f.ConfirmedAt}
	if withKey {
		dest = append(dest, &f.WrappedKey)
	}
	err := row.Scan(dest...)
	if f.Tags == nil {
		f.Tags = []string{}
	}
	return f, err
}

type NewFile struct {
	Owner     string
	CID       string
	ThumbCID  *string
	Encrypted bool
	Title     string
	Mime      string
	SizeBytes int64
	Width     *int32
	Height    *int32
	Tags      []string
	OwnerKey  *string // file key wrapped for the owner
}

// CreatePendingFile records upload metadata before the on-chain tx confirms.
// If the indexer already saw the CID (fast chain), metadata is merged into the confirmed row.
func (s *Store) CreatePendingFile(ctx context.Context, n NewFile) (File, error) {
	if n.Tags == nil {
		n.Tags = []string{}
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return File{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	f, err := scanFile(tx.QueryRow(ctx, `
		INSERT INTO files AS f (owner, cid, thumb_cid, encrypted, title, mime, size_bytes, width, height, tags)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		ON CONFLICT (owner, cid) DO UPDATE SET
			thumb_cid = EXCLUDED.thumb_cid, title = EXCLUDED.title, mime = EXCLUDED.mime,
			size_bytes = EXCLUDED.size_bytes, width = EXCLUDED.width, height = EXCLUDED.height,
			tags = EXCLUDED.tags, encrypted = EXCLUDED.encrypted
		RETURNING `+fileCols,
		n.Owner, n.CID, n.ThumbCID, n.Encrypted, n.Title, n.Mime, n.SizeBytes, n.Width, n.Height, n.Tags), false)
	if err != nil {
		return File{}, err
	}
	if n.OwnerKey != nil {
		if _, err := tx.Exec(ctx, `INSERT INTO file_keys(file_id, recipient, wrapped_key) VALUES ($1,$2,$3)
			ON CONFLICT (file_id, recipient) DO UPDATE SET wrapped_key = EXCLUDED.wrapped_key`,
			f.ID, n.Owner, *n.OwnerKey); err != nil {
			return File{}, err
		}
		f.WrappedKey = n.OwnerKey
	}
	return f, tx.Commit(ctx)
}

type ListParams struct {
	Owner   string
	Viewer  string
	AlbumID int64
	Tag     string
	Query   string
	Cursor  int64 // return files with id < Cursor (keyset pagination); 0 = first page
	Limit   int
}

// ListFiles returns a page of files newest-first plus the cursor for the next page (0 = end).
// Access must already be checked by the caller.
func (s *Store) ListFiles(ctx context.Context, p ListParams) ([]File, int64, error) {
	args := []any{p.Owner, p.Viewer}
	where := []string{"f.owner = $1"}
	arg := func(v any) string { args = append(args, v); return fmt.Sprintf("$%d", len(args)) }

	if p.Owner == p.Viewer {
		// Owners also see their own recent pending uploads (optimistic UI).
		where = append(where, `(f.status = 'confirmed' OR (f.status = 'pending' AND f.created_at > now() - interval '1 day'))`)
	} else {
		where = append(where, `f.status = 'confirmed'`)
	}
	if p.AlbumID > 0 {
		where = append(where, "EXISTS (SELECT 1 FROM album_files af WHERE af.file_id = f.id AND af.album_id = "+arg(p.AlbumID)+")")
	}
	if p.Tag != "" {
		// `tags @> ARRAY[x]` (not `x = ANY(tags)`) so Postgres can use the GIN index.
		where = append(where, "f.tags @> ARRAY["+arg(p.Tag)+"]::text[]")
	}
	if q := strings.TrimSpace(p.Query); q != "" {
		qa := arg(q)
		like := arg("%" + escapeLike(q) + "%")
		where = append(where, fmt.Sprintf(
			"(f.search @@ websearch_to_tsquery('simple', %s) OR f.title ILIKE %s OR f.tags @> ARRAY[lower(%s)]::text[])", qa, like, qa))
	}
	if p.Cursor > 0 {
		where = append(where, "f.id < "+arg(p.Cursor))
	}
	limit := p.Limit
	if limit <= 0 || limit > 100 {
		limit = 40
	}
	sql := `SELECT ` + fileCols + `, k.wrapped_key
		FROM files f LEFT JOIN file_keys k ON k.file_id = f.id AND k.recipient = $2
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY f.id DESC LIMIT ` + arg(limit+1)

	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	files := make([]File, 0, limit)
	for rows.Next() {
		f, err := scanFile(rows, true)
		if err != nil {
			return nil, 0, err
		}
		files = append(files, f)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	var next int64
	if len(files) > limit {
		files = files[:limit]
		next = files[limit-1].ID
	}
	return files, next, nil
}

func (s *Store) GetFile(ctx context.Context, id int64, viewer string) (File, error) {
	f, err := scanFile(s.pool.QueryRow(ctx, `SELECT `+fileCols+`, k.wrapped_key
		FROM files f LEFT JOIN file_keys k ON k.file_id = f.id AND k.recipient = $2
		WHERE f.id = $1`, id, viewer), true)
	if errors.Is(err, pgx.ErrNoRows) {
		return File{}, ErrNotFound
	}
	return f, err
}

func (s *Store) UpdateFile(ctx context.Context, owner string, id int64, title *string, tags []string) (File, error) {
	f, err := scanFile(s.pool.QueryRow(ctx, `
		UPDATE files f SET title = COALESCE($3, f.title), tags = COALESCE($4, f.tags)
		WHERE f.id = $1 AND f.owner = $2 RETURNING `+fileCols, id, owner, title, tags), false)
	if errors.Is(err, pgx.ErrNoRows) {
		return File{}, ErrNotFound
	}
	return f, err
}

type TagCount struct {
	Tag   string `json:"tag"`
	Count int64  `json:"count"`
}

func (s *Store) Tags(ctx context.Context, owner string) ([]TagCount, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT t, count(*) FROM files, unnest(tags) AS t
		WHERE owner = $1 AND status <> 'removed'
		GROUP BY t ORDER BY count(*) DESC, t LIMIT 100`, owner)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (TagCount, error) {
		var t TagCount
		err := r.Scan(&t.Tag, &t.Count)
		return t, err
	})
}

type Usage struct {
	Files     int64 `json:"files"`
	Bytes     int64 `json:"bytes"`
	Encrypted int64 `json:"encrypted"`
	Pending   int64 `json:"pending"`
}

func (s *Store) Usage(ctx context.Context, owner string) (Usage, error) {
	var u Usage
	err := s.pool.QueryRow(ctx, `
		SELECT count(*) FILTER (WHERE status='confirmed'),
		       coalesce(sum(size_bytes) FILTER (WHERE status='confirmed'), 0),
		       count(*) FILTER (WHERE status='confirmed' AND encrypted),
		       count(*) FILTER (WHERE status='pending')
		FROM files WHERE owner = $1`, owner).Scan(&u.Files, &u.Bytes, &u.Encrypted, &u.Pending)
	return u, err
}

func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}
