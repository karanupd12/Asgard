package httpapi

import (
	"net/http"
	"strings"

	"asgard/api/internal/auth"
)

func albumName(s string) (string, bool) {
	s = strings.TrimSpace(s)
	return s, s != "" && len(s) <= 80
}

func (s *Server) listAlbums(w http.ResponseWriter, r *http.Request) {
	albums, err := s.store.ListAlbums(r.Context(), auth.Address(r.Context()))
	if err != nil {
		s.writeRepoError(w, r, err)
		return
	}
	writeJSON(w, r, http.StatusOK, map[string]any{"albums": albums})
}

func (s *Server) createAlbum(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	name, ok := albumName(req.Name)
	if !ok {
		writeError(w, http.StatusBadRequest, "name must be 1-80 characters")
		return
	}
	a, err := s.store.CreateAlbum(r.Context(), auth.Address(r.Context()), name)
	if err != nil {
		s.writeRepoError(w, r, err)
		return
	}
	writeJSON(w, r, http.StatusCreated, a)
}

func (s *Server) renameAlbum(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r, "id")
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	name, ok := albumName(req.Name)
	if !ok {
		writeError(w, http.StatusBadRequest, "name must be 1-80 characters")
		return
	}
	if err := s.store.RenameAlbum(r.Context(), auth.Address(r.Context()), id, name); err != nil {
		s.writeRepoError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) deleteAlbum(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r, "id")
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := s.store.DeleteAlbum(r.Context(), auth.Address(r.Context()), id); err != nil {
		s.writeRepoError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) addToAlbum(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r, "id")
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req struct {
		FileIDs []int64 `json:"fileIds"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	if len(req.FileIDs) == 0 || len(req.FileIDs) > 500 {
		writeError(w, http.StatusBadRequest, "fileIds must have 1-500 entries")
		return
	}
	n, err := s.store.AddToAlbum(r.Context(), auth.Address(r.Context()), id, req.FileIDs)
	if err != nil {
		s.writeRepoError(w, r, err)
		return
	}
	writeJSON(w, r, http.StatusOK, map[string]int64{"added": n})
}

func (s *Server) removeFromAlbum(w http.ResponseWriter, r *http.Request) {
	id, ok1 := pathID(r, "id")
	fileID, ok2 := pathID(r, "fileId")
	if !ok1 || !ok2 {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := s.store.RemoveFromAlbum(r.Context(), auth.Address(r.Context()), id, fileID); err != nil {
		s.writeRepoError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
