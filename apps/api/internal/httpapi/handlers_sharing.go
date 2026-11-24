package httpapi

import (
	"net/http"

	"asgard/api/internal/auth"
	"asgard/api/internal/repo"
)

// viewers lists who the caller has granted access to (mirrored from chain events).
func (s *Server) viewers(w http.ResponseWriter, r *http.Request) {
	v, err := s.store.Viewers(r.Context(), auth.Address(r.Context()))
	if err != nil {
		s.writeRepoError(w, r, err)
		return
	}
	writeJSON(w, r, http.StatusOK, map[string]any{"viewers": v})
}

func (s *Server) sharedWithMe(w http.ResponseWriter, r *http.Request) {
	o, err := s.store.SharedWithMe(r.Context(), auth.Address(r.Context()))
	if err != nil {
		s.writeRepoError(w, r, err)
		return
	}
	writeJSON(w, r, http.StatusOK, map[string]any{"owners": o})
}

// missingKeys returns (file, viewer) pairs that still need a wrapped key from the owner.
func (s *Server) missingKeys(w http.ResponseWriter, r *http.Request) {
	k, err := s.store.MissingKeys(r.Context(), auth.Address(r.Context()))
	if err != nil {
		s.writeRepoError(w, r, err)
		return
	}
	writeJSON(w, r, http.StatusOK, map[string]any{"missing": k})
}

func (s *Server) putWrappedKeys(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Keys []repo.WrappedKey `json:"keys"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	if len(req.Keys) == 0 || len(req.Keys) > 500 {
		writeError(w, http.StatusBadRequest, "keys must have 1-500 entries")
		return
	}
	for i, k := range req.Keys {
		addr, ok := normAddress(k.Recipient)
		if !ok || k.WrappedKey == "" || len(k.WrappedKey) > 512 {
			writeError(w, http.StatusBadRequest, "invalid key entry")
			return
		}
		req.Keys[i].Recipient = addr
	}
	n, err := s.store.PutWrappedKeys(r.Context(), auth.Address(r.Context()), req.Keys)
	if err != nil {
		s.writeRepoError(w, r, err)
		return
	}
	writeJSON(w, r, http.StatusOK, map[string]int64{"stored": n})
}
