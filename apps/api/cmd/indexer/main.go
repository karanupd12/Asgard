package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"

	"asgard/api/internal/config"
	"asgard/api/internal/db"
	"asgard/api/internal/indexer"
	"asgard/api/internal/repo"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil)).With("svc", "indexer")
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

	ix := indexer.New(indexer.Config{
		Contract:      common.HexToAddress(cfg.ContractAddress),
		StartBlock:    cfg.StartBlock,
		Confirmations: cfg.Confirmations,
		Batch:         cfg.IndexerBatch,
		Interval:      cfg.IndexerInterval,
	}, eth, repo.New(pool), log)
	return ix.Run(ctx)
}
