// Package httpapi is the REST API (handlers -> repo).
package httpapi

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"asgard/api/internal/auth"
	"asgard/api/internal/config"
	"asgard/api/internal/gas"
	"asgard/api/internal/repo"
	"asgard/api/internal/storage"
)

type Server struct {
	cfg     *config.Config
	store   *repo.Store
	tokens  *auth.Tokens
	storage storage.Provider
	gas     *gas.Estimator
	eth     *ethclient.Client
	log     *slog.Logger
}

func New(cfg *config.Config, store *repo.Store, sp storage.Provider, eth *ethclient.Client, log *slog.Logger) *Server {
	return &Server{
		cfg:     cfg,
		store:   store,
		tokens:  auth.NewTokens(cfg.JWTSecret),
		storage: sp,
		gas:     gas.NewEstimator(eth, 15*time.Second),
		eth:     eth,
		log:     log,
	}
}

func (s *Server) Routes() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.RealIP, s.logRequests, middleware.Recoverer)
	if len(s.cfg.CORSOrigins) > 0 {
		r.Use(cors.Handler(cors.Options{
			AllowedOrigins:   s.cfg.CORSOrigins,
			AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
			AllowedHeaders:   []string{"Content-Type", "Authorization", "If-None-Match"},
			AllowCredentials: true,
			MaxAge:           600,
		}))
	}
	r.Use(s.tokens.Middleware)
	r.Get("/healthz", s.health)

	r.Route("/api", func(r chi.Router) {
		// Uploads stream large bodies: no compression, longer deadline.
		r.With(auth.Require, middleware.Timeout(5*time.Minute)).Post("/uploads", s.upload)

		r.Group(func(r chi.Router) {
			r.Use(middleware.Compress(5, "application/json"), middleware.Timeout(30*time.Second))

			r.Get("/healthz", s.health)
			r.Get("/config", s.getConfig)
			r.Get("/status", s.status)
			r.Get("/gas/estimate", s.gasEstimate)
			r.Post("/auth/nonce", s.nonce)
			r.Post("/auth/verify", s.verify)
			r.Post("/auth/logout", s.logout)
			r.Get("/keys/{address}", s.getKey)

			r.Group(func(r chi.Router) {
				r.Use(auth.Require)
				r.Get("/me", s.me)
				r.Put("/me/key", s.putKey)

				r.Get("/files", s.listFiles)
				r.Get("/files/{id}", s.getFile)
				r.Patch("/files/{id}", s.updateFile)
				r.Get("/tags", s.tags)

				r.Get("/albums", s.listAlbums)
				r.Post("/albums", s.createAlbum)
				r.Patch("/albums/{id}", s.renameAlbum)
				r.Delete("/albums/{id}", s.deleteAlbum)
				r.Post("/albums/{id}/files", s.addToAlbum)
				r.Delete("/albums/{id}/files/{fileId}", s.removeFromAlbum)

				r.Get("/shares", s.viewers)
				r.Get("/shared-with-me", s.sharedWithMe)
				r.Get("/keys/missing", s.missingKeys)
				r.Post("/keys/wrapped", s.putWrappedKeys)
			})
		})
	})
	return r
}

func (s *Server) logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		next.ServeHTTP(ww, r)
		if r.URL.Path == "/healthz" {
			return
		}
		s.log.Info("http", "method", r.Method, "path", r.URL.Path, "status", ww.Status(),
			"bytes", ww.BytesWritten(), "ms", time.Since(start).Milliseconds(),
			"req_id", middleware.GetReqID(r.Context()))
	})
}
