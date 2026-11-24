package httpapi

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/ethereum/go-ethereum/common/hexutil"

	"asgard/api/internal/auth"
	"asgard/api/internal/repo"
	"asgard/api/internal/storage"
)

const maxThumbBytes = 2 << 20

type uploadMeta struct {
	Title      string   `json:"title"`
	Mime       string   `json:"mime"`
	SizeBytes  int64    `json:"sizeBytes"`
	Width      *int32   `json:"width"`
	Height     *int32   `json:"height"`
	Encrypted  bool     `json:"encrypted"`
	Tags       []string `json:"tags"`
	WrappedKey *string  `json:"wrappedKey"` // file key wrapped for the owner (encrypted only)
}

var (
	errTooLarge    = errors.New("file too large")
	errUnsupported = errors.New("unsupported content type (images only)")
)

// limitReader fails (instead of silently truncating) once more than n bytes are read,
// which aborts the streaming upload to IPFS mid-flight.
type limitReader struct {
	r io.Reader
	n int64
}

func (l *limitReader) Read(p []byte) (int, error) {
	if l.n < 0 {
		return 0, errTooLarge
	}
	n, err := l.r.Read(p)
	l.n -= int64(n)
	if l.n < 0 {
		return n, errTooLarge
	}
	return n, err
}

// pin streams one multipart part to IPFS. Plaintext uploads are MIME-sniffed; ciphertext
// can't be, so for encrypted uploads the declared MIME (validated in meta) is trusted.
func (s *Server) pin(ctx context.Context, r io.Reader, name string, max int64, encrypted bool) (string, error) {
	br := bufio.NewReaderSize(r, 4096)
	if !encrypted {
		head, _ := br.Peek(512)
		if ct := http.DetectContentType(head); !strings.HasPrefix(ct, "image/") {
			return "", fmt.Errorf("%w: got %q", errUnsupported, ct)
		}
	}
	lr := &limitReader{r: br, n: max}
	cid, err := s.storage.Add(ctx, name, lr)
	if lr.n < 0 {
		return "", errTooLarge // transport may wrap the reader error; check the counter instead
	}
	if err != nil {
		return "", err
	}
	return storage.NormalizeCID(cid)
}

// upload: multipart/form-data with parts in order: meta (JSON), file, [thumb].
// Responds with the CID and its on-chain encoding; the client then signs addFiles().
func (s *Server) upload(w http.ResponseWriter, r *http.Request) {
	owner := auth.Address(r.Context())
	r.Body = http.MaxBytesReader(w, r.Body, s.cfg.MaxUploadBytes+maxThumbBytes+(1<<20))
	mr, err := r.MultipartReader()
	if err != nil {
		writeError(w, http.StatusBadRequest, "expected multipart/form-data")
		return
	}

	var (
		meta     *uploadMeta
		cid      string
		thumbCID *string
	)
	for {
		part, err := mr.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad multipart body")
			return
		}
		switch part.FormName() {
		case "meta":
			meta = &uploadMeta{}
			if err := json.NewDecoder(io.LimitReader(part, 64<<10)).Decode(meta); err != nil {
				writeError(w, http.StatusBadRequest, "invalid meta JSON")
				return
			}
			if msg := validateMeta(meta); msg != "" {
				writeError(w, http.StatusBadRequest, msg)
				return
			}
		case "file", "thumb":
			if meta == nil {
				writeError(w, http.StatusBadRequest, "meta part must come first")
				return
			}
			max := s.cfg.MaxUploadBytes
			if part.FormName() == "thumb" {
				max = maxThumbBytes
			}
			c, err := s.pin(r.Context(), part, part.FormName(), max, meta.Encrypted)
			if errors.Is(err, errUnsupported) {
				writeError(w, http.StatusUnsupportedMediaType, err.Error())
				return
			}
			if errors.Is(err, errTooLarge) {
				writeError(w, http.StatusRequestEntityTooLarge, fmt.Sprintf("%s exceeds %d MB", part.FormName(), max>>20))
				return
			}
			if err != nil {
				s.log.Warn("pin failed", "err", err)
				writeError(w, http.StatusBadGateway, "ipfs: "+err.Error())
				return
			}
			if part.FormName() == "file" {
				cid = c
			} else {
				thumbCID = &c
			}
		}
		part.Close()
	}
	if meta == nil || cid == "" {
		writeError(w, http.StatusBadRequest, "meta and file parts are required")
		return
	}

	f, err := s.store.CreatePendingFile(r.Context(), repo.NewFile{
		Owner: owner, CID: cid, ThumbCID: thumbCID, Encrypted: meta.Encrypted, Title: meta.Title,
		Mime: meta.Mime, SizeBytes: meta.SizeBytes, Width: meta.Width, Height: meta.Height,
		Tags: normTags(meta.Tags), OwnerKey: meta.WrappedKey,
	})
	if err != nil {
		s.writeRepoError(w, r, err)
		return
	}
	digest, codec, _ := storage.ToDigest(cid)
	writeJSON(w, r, http.StatusCreated, map[string]any{
		"file":   f,
		"digest": hexutil.Encode(digest[:]),
		"codec":  codec,
	})
}

func validateMeta(m *uploadMeta) string {
	m.Title = strings.TrimSpace(m.Title)
	switch {
	case len(m.Title) > 200:
		return "title too long"
	case !strings.HasPrefix(m.Mime, "image/"):
		return "mime must be image/*"
	case m.Encrypted && (m.WrappedKey == nil || *m.WrappedKey == ""):
		return "encrypted uploads require wrappedKey"
	case !m.Encrypted && m.WrappedKey != nil:
		return "wrappedKey only allowed for encrypted uploads"
	case m.WrappedKey != nil && len(*m.WrappedKey) > 512:
		return "wrappedKey too long"
	}
	return ""
}

func (s *Server) listFiles(w http.ResponseWriter, r *http.Request) {
	me := auth.Address(r.Context())
	q := r.URL.Query()

	owner := me
	if o := q.Get("owner"); o != "" {
		var ok bool
		if owner, ok = normAddress(o); !ok {
			writeError(w, http.StatusBadRequest, "invalid owner")
			return
		}
	}
	allowed, err := s.store.HasAccess(r.Context(), owner, me)
	if err != nil {
		s.writeRepoError(w, r, err)
		return
	}
	if !allowed {
		writeError(w, http.StatusForbidden, "no access to this owner's files")
		return
	}

	p := repo.ListParams{Owner: owner, Viewer: me, Tag: strings.ToLower(q.Get("tag")), Query: q.Get("q")}
	p.Cursor, _ = strconv.ParseInt(q.Get("cursor"), 10, 64)
	p.Limit, _ = strconv.Atoi(q.Get("limit"))
	if a := q.Get("album"); a != "" {
		p.AlbumID, _ = strconv.ParseInt(a, 10, 64)
		albumOwner, err := s.store.AlbumOwner(r.Context(), p.AlbumID)
		if err != nil || albumOwner != owner {
			writeError(w, http.StatusNotFound, "album not found")
			return
		}
	}

	files, next, err := s.store.ListFiles(r.Context(), p)
	if err != nil {
		s.writeRepoError(w, r, err)
		return
	}
	ownerKey, _ := s.store.PublicKey(r.Context(), owner)
	resp := map[string]any{"files": files, "nextCursor": nil, "ownerPublicKey": nil}
	if next > 0 {
		resp["nextCursor"] = next
	}
	if ownerKey != "" {
		resp["ownerPublicKey"] = ownerKey
	}
	writeJSON(w, r, http.StatusOK, resp)
}

func (s *Server) getFile(w http.ResponseWriter, r *http.Request) {
	me := auth.Address(r.Context())
	id, ok := pathID(r, "id")
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	f, err := s.store.GetFile(r.Context(), id, me)
	if err != nil {
		s.writeRepoError(w, r, err)
		return
	}
	if allowed, _ := s.store.HasAccess(r.Context(), f.Owner, me); !allowed || (f.Owner != me && f.Status != "confirmed") {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	writeJSON(w, r, http.StatusOK, f)
}

func (s *Server) updateFile(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r, "id")
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req struct {
		Title *string   `json:"title"`
		Tags  *[]string `json:"tags"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.Title != nil {
		t := strings.TrimSpace(*req.Title)
		if len(t) > 200 {
			writeError(w, http.StatusBadRequest, "title too long")
			return
		}
		req.Title = &t
	}
	var tags []string
	if req.Tags != nil {
		tags = normTags(*req.Tags)
	}
	f, err := s.store.UpdateFile(r.Context(), auth.Address(r.Context()), id, req.Title, tags)
	if err != nil {
		s.writeRepoError(w, r, err)
		return
	}
	writeJSON(w, r, http.StatusOK, f)
}

func (s *Server) tags(w http.ResponseWriter, r *http.Request) {
	t, err := s.store.Tags(r.Context(), auth.Address(r.Context()))
	if err != nil {
		s.writeRepoError(w, r, err)
		return
	}
	writeJSON(w, r, http.StatusOK, map[string]any{"tags": t})
}
