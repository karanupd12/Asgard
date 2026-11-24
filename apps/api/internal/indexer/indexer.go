// Package indexer mirrors AsgardVault events into Postgres.
//
// Design:
//   - Polls eth_getLogs in bounded block ranges (RPC providers cap range size).
//   - Only processes blocks at least `confirmations` deep, so short reorgs never reach the DB.
//   - Each range's events and the cursor advance commit in ONE transaction: a crash replays the
//     range from the old cursor, and every handler is an idempotent upsert.
package indexer

import (
	"context"
	"fmt"
	"log/slog"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"

	"asgard/api/internal/chain"
	"asgard/api/internal/repo"
	"asgard/api/internal/storage"
)

type Config struct {
	Contract      common.Address
	StartBlock    uint64
	Confirmations uint64
	Batch         uint64
	Interval      time.Duration
}

type Indexer struct {
	cfg    Config
	client *ethclient.Client
	store  *repo.Store
	log    *slog.Logger
	topics []common.Hash
}

func New(cfg Config, client *ethclient.Client, store *repo.Store, log *slog.Logger) *Indexer {
	ev := chain.VaultABI.Events
	return &Indexer{cfg: cfg, client: client, store: store, log: log, topics: []common.Hash{
		ev["FileAdded"].ID, ev["FileRemoved"].ID, ev["AccessGranted"].ID, ev["AccessRevoked"].ID,
	}}
}

func (ix *Indexer) Run(ctx context.Context) error {
	ix.log.Info("indexer started", "contract", ix.cfg.Contract.Hex(), "start", ix.cfg.StartBlock,
		"confirmations", ix.cfg.Confirmations)
	for {
		n, err := ix.step(ctx)
		if err != nil {
			ix.log.Error("indexer step failed", "err", err)
		}
		if n == 0 || err != nil { // caught up (or failing): wait before polling again
			select {
			case <-ctx.Done():
				return nil
			case <-time.After(ix.cfg.Interval):
			}
		}
	}
}

// step indexes one block range and returns how many blocks it advanced.
func (ix *Indexer) step(ctx context.Context) (uint64, error) {
	head, err := ix.client.BlockNumber(ctx)
	if err != nil {
		return 0, fmt.Errorf("block number: %w", err)
	}
	if head < ix.cfg.Confirmations {
		return 0, nil
	}
	safe := head - ix.cfg.Confirmations

	from, err := ix.store.NextBlock(ctx, ix.cfg.StartBlock)
	if err != nil {
		return 0, err
	}
	if from > safe {
		return 0, nil
	}
	to := min(safe, from+ix.cfg.Batch-1)

	logs, err := ix.client.FilterLogs(ctx, ethereum.FilterQuery{
		FromBlock: new(big.Int).SetUint64(from),
		ToBlock:   new(big.Int).SetUint64(to),
		Addresses: []common.Address{ix.cfg.Contract},
		Topics:    [][]common.Hash{ix.topics},
	})
	if err != nil {
		return 0, fmt.Errorf("filter logs %d-%d: %w", from, to, err)
	}

	err = ix.store.InIndexerTx(ctx, func(tx *repo.IndexerTx) error {
		for _, l := range logs {
			if l.Removed {
				continue
			}
			if err := ix.apply(ctx, tx, l); err != nil {
				return fmt.Errorf("apply log %s#%d: %w", l.TxHash.Hex(), l.Index, err)
			}
		}
		return tx.SetNextBlock(ctx, to+1)
	})
	if err != nil {
		return 0, err
	}
	if len(logs) > 0 {
		ix.log.Info("indexed", "from", from, "to", to, "events", len(logs), "lag", head-to)
	}
	return to - from + 1, nil
}

func addr(h common.Hash) string { return strings.ToLower(common.BytesToAddress(h.Bytes()).Hex()) }

func (ix *Indexer) apply(ctx context.Context, tx *repo.IndexerTx, l types.Log) error {
	ev, err := chain.VaultABI.EventByID(l.Topics[0])
	if err != nil {
		return err
	}
	owner := addr(l.Topics[1])

	switch ev.Name {
	case "FileAdded":
		vals, err := ev.Inputs.NonIndexed().Unpack(l.Data)
		if err != nil {
			return err
		}
		digest := vals[0].([32]byte)
		codec := vals[1].(uint64)
		encrypted := vals[2].(bool)
		cid, err := storage.FromDigest(digest, codec)
		if err != nil {
			return err
		}
		return tx.FileAdded(ctx, owner, cid, l.Topics[2].Big().Int64(), encrypted, l.TxHash.Hex(), l.BlockNumber)
	case "FileRemoved":
		return tx.FileRemoved(ctx, owner, l.Topics[2].Big().Int64())
	case "AccessGranted":
		return tx.AccessGranted(ctx, owner, addr(l.Topics[2]))
	case "AccessRevoked":
		return tx.AccessRevoked(ctx, owner, addr(l.Topics[2]))
	}
	return nil
}
