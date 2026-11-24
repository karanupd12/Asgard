package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ethereum/go-ethereum/ethclient"

	"asgard/api/internal/config"
	"asgard/api/internal/db"
	"asgard/api/internal/httpapi"
	"asgard/api/internal/repo"
	"asgard/api/internal/storage"
)

func main() {
	// `api healthcheck` lets the distroless container (no curl/wget) report its own health.
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		addr := os.Getenv("HTTP_ADDR")
		if addr == "" {
			addr = ":8080"
		}
		resp, err := (&http.Client{Timeout: 3 * time.Second}).Get("http://127.0.0.1" + addr + "/healthz")
		if err != nil || resp.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		os.Exit(0)
	}

	log := slog.New(slog.NewJSONHandler(os.Stdout, nil)).With("svc", "api")
	if err := run(log); err != nil {
		log.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool, log); err != nil {
		return err
	}

	eth, err := ethclient.DialContext(ctx, cfg.RPCURL)
	if err != nil {
		return err
	}
	defer eth.Close()

	var sp storage.Provider = storage.NewKubo(cfg.KuboAPIURL)
	if cfg.StorageProvider == "pinata" {
		sp = storage.NewPinata(cfg.PinataJWT)
	}

	srv := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           httpapi.New(cfg, repo.New(pool), sp, eth, log).Routes(),
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		log.Info("listening", "addr", cfg.HTTPAddr, "storage", sp.Name(), "contract", cfg.ContractAddress)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
	}
	log.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}
