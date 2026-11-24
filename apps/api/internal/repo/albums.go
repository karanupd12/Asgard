package repo

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type Album struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	FileCount int64     `json:"fileCount"`
	CreatedAt time.Time `json:"createdAt"`
	Cover     *File     `json:"cover"`
}

func (s *Store) ListAlbums(ctx context.Context, owner string) ([]Album, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT a.id, a.name, a.created_at,
		       (SELECT count(*) FROM album_files af JOIN files f ON f.id = af.file_id
		         WHERE af.album_id = a.id AND f.status <> 'removed'),
		       (SELECT af.file_id FROM album_files af JOIN files f ON f.id = af.file_id
		         WHERE af.album_id = a.id AND f.status <> 'removed' ORDER BY af.added_at DESC LIMIT 1)
		FROM albums a WHERE a.owner = $1 ORDER BY a.created_at DESC`, owner)
	if err != nil {
		return nil, err
	}
	type row struct {
		a     Album
		cover *int64
	}
	rs, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (row, error) {
		var x row
		err := r.Scan(&x.a.ID, &x.a.Name, &x.a.CreatedAt, &x.a.FileCount, &x.cover)
		return x, err
	})
	if err != nil {
		return nil, err
	}
	albums := make([]Album, 0, len(rs))
	for _, x := range rs {
		if x.cover != nil {
			if f, err := s.GetFile(ctx, *x.cover, owner); err == nil {
				x.a.Cover = &f
			}
		}
		albums = append(albums, x.a)
	}
	return albums, nil
}

func (s *Store) CreateAlbum(ctx context.Context, owner, name string) (Album, error) {
	a := Album{Name: name}
	err := s.pool.QueryRow(ctx, `INSERT INTO albums(owner, name) VALUES ($1,$2) RETURNING id, created_at`,
		owner, name).Scan(&a.ID, &a.CreatedAt)
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" {
		return Album{}, ErrConflict
	}
	return a, err
}

func (s *Store) RenameAlbum(ctx context.Context, owner string, id int64, name string) error {
	tag, err := s.pool.Exec(ctx, `UPDATE albums SET name=$3 WHERE id=$1 AND owner=$2`, id, owner, name)
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" {
		return ErrConflict
	}
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

func (s *Store) DeleteAlbum(ctx context.Context, owner string, id int64) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM albums WHERE id=$1 AND owner=$2`, id, owner)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

func (s *Store) AlbumOwner(ctx context.Context, id int64) (string, error) {
	var owner string
	err := s.pool.QueryRow(ctx, `SELECT owner FROM albums WHERE id=$1`, id).Scan(&owner)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return owner, err
}

// AddToAlbum adds the caller's own files to the caller's album; foreign file ids are ignored.
func (s *Store) AddToAlbum(ctx context.Context, owner string, albumID int64, fileIDs []int64) (int64, error) {
	tag, err := s.pool.Exec(ctx, `
		INSERT INTO album_files(album_id, file_id)
		SELECT a.id, f.id FROM albums a JOIN files f ON f.owner = a.owner
		WHERE a.id = $1 AND a.owner = $2 AND f.id = ANY($3)
		ON CONFLICT DO NOTHING`, albumID, owner, fileIDs)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

func (s *Store) RemoveFromAlbum(ctx context.Context, owner string, albumID, fileID int64) error {
	_, err := s.pool.Exec(ctx, `
		DELETE FROM album_files af USING albums a
		WHERE af.album_id = a.id AND a.id = $1 AND a.owner = $2 AND af.file_id = $3`, albumID, owner, fileID)
	return err
}
