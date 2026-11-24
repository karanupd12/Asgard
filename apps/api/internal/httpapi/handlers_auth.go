package httpapi

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"asgard/api/internal/auth"
	"asgard/api/internal/repo"
)

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	if err := s.store.Ping(r.Context()); err != nil {
		writeError(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	writeJSON(w, r, http.StatusOK, map[string]string{"status": "ok"})
}

// getConfig gives the SPA its runtime settings, so one web build works on any network.
func (s *Server) getConfig(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, r, http.StatusOK, map[string]any{
		"chainId":         s.cfg.ChainID,
		"contractAddress": s.cfg.ContractAddress,
		"gatewayUrl":      s.cfg.GatewayURL,
		"storageProvider": s.storage.Name(),
		"maxUploadMb":     s.cfg.MaxUploadBytes >> 20,
	})
}

// status reports indexer lag so the UI can show "syncing" instead of stale data.
func (s *Server) status(w http.ResponseWriter, r *http.Request) {
	head, err := s.eth.BlockNumber(r.Context())
	if err != nil {
		writeError(w, http.StatusBadGateway, "rpc unavailable")
		return
	}
	next, err := s.store.NextBlock(r.Context(), s.cfg.StartBlock)
	if err != nil {
		s.writeRepoError(w, r, err)
		return
	}
	lag := uint64(0)
	if head+1 > next {
		lag = head + 1 - next
	}
	writeJSON(w, r, http.StatusOK, map[string]any{"headBlock": head, "indexedBlock": next - 1, "lagBlocks": lag})
}

func (s *Server) nonce(w http.ResponseWriter, r *http.Request) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		writeError(w, http.StatusInternalServerError, "rng")
		return
	}
	n := hex.EncodeToString(b)
	if err := s.store.CreateNonce(r.Context(), n); err != nil {
		s.writeRepoError(w, r, err)
		return
	}
	writeJSON(w, r, http.StatusOK, map[string]string{"nonce": n})
}

func (s *Server) verify(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Message   string `json:"message"`
		Signature string `json:"signature"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	msg, err := auth.ParseSIWE(req.Message)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := msg.Validate(s.cfg.SIWEDomain, s.cfg.ChainID, time.Now()); err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}
	if err := auth.VerifySignature(msg, req.Signature); err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}
	ok, err := s.store.ConsumeNonce(r.Context(), msg.Nonce)
	if err != nil {
		s.writeRepoError(w, r, err)
		return
	}
	if !ok {
		writeError(w, http.StatusUnauthorized, "nonce expired or already used")
		return
	}

	address := strings.ToLower(msg.Address.Hex())
	if err := s.store.TouchUser(r.Context(), address); err != nil {
		s.writeRepoError(w, r, err)
		return
	}
	token, exp, err := s.tokens.Issue(address)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "token")
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name: auth.CookieName, Value: token, Path: "/", Expires: exp,
		HttpOnly: true, Secure: s.cfg.CookieSecure, SameSite: http.SameSiteLaxMode,
	})
	writeJSON(w, r, http.StatusOK, map[string]string{"address": address})
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{Name: auth.CookieName, Value: "", Path: "/", MaxAge: -1,
		HttpOnly: true, Secure: s.cfg.CookieSecure, SameSite: http.SameSiteLaxMode})
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	me := auth.Address(r.Context())
	pk, err := s.store.PublicKey(r.Context(), me)
	if err != nil && !errors.Is(err, repo.ErrNotFound) {
		s.writeRepoError(w, r, err)
		return
	}
	usage, err := s.store.Usage(r.Context(), me)
	if err != nil {
		s.writeRepoError(w, r, err)
		return
	}
	var pkp *string
	if pk != "" {
		pkp = &pk
	}
	writeJSON(w, r, http.StatusOK, map[string]any{"address": me, "publicKey": pkp, "usage": usage})
}

var pubKeyRe = regexp.MustCompile(`^0x[0-9a-f]{64}$`)

func (s *Server) putKey(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PublicKey string `json:"publicKey"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	pk := strings.ToLower(req.PublicKey)
	if !pubKeyRe.MatchString(pk) {
		writeError(w, http.StatusBadRequest, "publicKey must be 32-byte hex (0x...)")
		return
	}
	if err := s.store.SetPublicKey(r.Context(), auth.Address(r.Context()), pk); err != nil {
		s.writeRepoError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) getKey(w http.ResponseWriter, r *http.Request) {
	addr, ok := normAddress(chi.URLParam(r, "address"))
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid address")
		return
	}
	pk, err := s.store.PublicKey(r.Context(), addr)
	if err != nil {
		s.writeRepoError(w, r, err)
		return
	}
	writeJSON(w, r, http.StatusOK, map[string]string{"address": addr, "publicKey": pk})
}

func (s *Server) gasEstimate(w http.ResponseWriter, r *http.Request) {
	n := 1
	if v := r.URL.Query().Get("files"); v != "" {
		var err error
		if n, err = strconv.Atoi(v); err != nil || n < 1 || n > 50 {
			writeError(w, http.StatusBadRequest, "files must be 1..50")
			return
		}
	}
	first := false
	if me := auth.Address(r.Context()); me != "" {
		if u, err := s.store.Usage(r.Context(), me); err == nil {
			first = u.Files == 0 && u.Pending == 0
		}
	}
	est, err := s.gas.Estimate(r.Context(), n, first)
	if err != nil {
		writeError(w, http.StatusBadGateway, "rpc unavailable")
		return
	}
	writeJSON(w, r, http.StatusOK, est)
}
