package httpapi

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/ethereum/go-ethereum/common"
	"github.com/go-chi/chi/v5"

	"asgard/api/internal/repo"
)

// writeJSON writes v as JSON. GET responses carry a content-hash ETag so clients that poll
// (gallery refresh, gas widget) get cheap 304s when nothing changed.
func writeJSON(w http.ResponseWriter, r *http.Request, status int, v any) {
	body, err := json.Marshal(v)
	if err != nil {
		http.Error(w, `{"error":"encode"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if r.Method == http.MethodGet && status == http.StatusOK {
		sum := sha1.Sum(body)
		etag := `W/"` + hex.EncodeToString(sum[:8]) + `"`
		w.Header().Set("ETag", etag)
		w.Header().Set("Cache-Control", "private, no-cache")
		if r.Header.Get("If-None-Match") == etag {
			w.WriteHeader(http.StatusNotModified)
			return
		}
	}
	w.WriteHeader(status)
	w.Write(body) //nolint:errcheck
}

func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg}) //nolint:errcheck
}

// writeRepoError maps repository errors onto HTTP statuses.
func (s *Server) writeRepoError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, repo.ErrNotFound):
		writeError(w, http.StatusNotFound, "not found")
	case errors.Is(err, repo.ErrForbidden):
		writeError(w, http.StatusForbidden, "forbidden")
	case errors.Is(err, repo.ErrConflict):
		writeError(w, http.StatusConflict, "already exists")
	default:
		s.log.Error("internal error", "path", r.URL.Path, "err", err)
		writeError(w, http.StatusInternalServerError, "internal error")
	}
}

func decodeJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return false
	}
	return true
}

func pathID(r *http.Request, name string) (int64, bool) {
	id, err := strconv.ParseInt(chi.URLParam(r, name), 10, 64)
	return id, err == nil && id > 0
}

// normAddress validates and lowercases a hex address.
func normAddress(s string) (string, bool) {
	if !common.IsHexAddress(s) {
		return "", false
	}
	return strings.ToLower(common.HexToAddress(s).Hex()), true
}

// normTags lowercases, trims, dedupes and bounds user tags.
func normTags(in []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(in))
	for _, t := range in {
		t = strings.ToLower(strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(t), "#")))
		if t == "" || len(t) > 32 || seen[t] {
			continue
		}
		seen[t] = true
		out = append(out, t)
		if len(out) == 20 {
			break
		}
	}
	return out
}
