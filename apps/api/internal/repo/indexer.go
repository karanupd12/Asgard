package repo

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// IndexerTx applies one block range of chain events atomically together with the cursor,
// so a crash mid-range can never double-apply or skip events (exactly-once effect).
type IndexerTx struct{ tx pgx.Tx }

func (s *Store) NextBlock(ctx context.Context, start uint64) (uint64, error) {
	var n int64
	err := s.pool.QueryRow(ctx, `SELECT next_block FROM indexer_state WHERE id=1`).Scan(&n)
	if errors.Is(err, pgx.ErrNoRows) {
		return start, nil
	}
	return uint64(n), err
}

func (s *Store) InIndexerTx(ctx context.Context, fn func(*IndexerTx) error) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error { return fn(&IndexerTx{tx: tx}) })
}

func (t *IndexerTx) SetNextBlock(ctx context.Context, n uint64) error {
	_, err := t.tx.Exec(ctx, `INSERT INTO indexer_state(id, next_block) VALUES (1,$1)
		ON CONFLICT (id) DO UPDATE SET next_block=$1, updated_at=now()`, int64(n))
	return err
}

func (t *IndexerTx) FileAdded(ctx context.Context, owner, cid string, fileID int64, encrypted bool,
	txHash string, block uint64) error {
	// Upsert: the upload endpoint usually inserted a 'pending' row with metadata already.
	_, err := t.tx.Exec(ctx, `
		INSERT INTO files AS f (owner, cid, chain_file_id, status, encrypted, tx_hash, block_number, confirmed_at)
		VALUES ($1,$2,$3,'confirmed',$4,$5,$6, now())
		ON CONFLICT (owner, cid) DO UPDATE SET
			chain_file_id = COALESCE(f.chain_file_id, EXCLUDED.chain_file_id),
			status        = CASE WHEN f.status = 'removed' THEN 'removed' ELSE 'confirmed' END,
			encrypted     = EXCLUDED.encrypted,
			tx_hash       = COALESCE(f.tx_hash, EXCLUDED.tx_hash),
			block_number  = COALESCE(f.block_number, EXCLUDED.block_number),
			confirmed_at  = COALESCE(f.confirmed_at, EXCLUDED.confirmed_at)`,
		owner, cid, fileID, encrypted, txHash, int64(block))
	return err
}

func (t *IndexerTx) FileRemoved(ctx context.Context, owner string, fileID int64) error {
	_, err := t.tx.Exec(ctx, `UPDATE files SET status='removed' WHERE owner=$1 AND chain_file_id=$2`, owner, fileID)
	return err
}

func (t *IndexerTx) AccessGranted(ctx context.Context, owner, viewer string) error {
	_, err := t.tx.Exec(ctx, `INSERT INTO access_grants(owner, viewer) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
		owner, viewer)
	return err
}

// AccessRevoked removes the grant and every wrapped key the viewer held for the owner's files.
func (t *IndexerTx) AccessRevoked(ctx context.Context, owner, viewer string) error {
	if _, err := t.tx.Exec(ctx, `DELETE FROM access_grants WHERE owner=$1 AND viewer=$2`, owner, viewer); err != nil {
		return err
	}
	_, err := t.tx.Exec(ctx, `DELETE FROM file_keys k USING files f
		WHERE k.file_id = f.id AND f.owner = $1 AND k.recipient = $2`, owner, viewer)
	return err
}
