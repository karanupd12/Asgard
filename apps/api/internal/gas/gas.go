// Package gas estimates the cost of AsgardVault uploads using the live gas price.
package gas

import (
	"context"
	"math/big"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/ethclient"
)

// Gas model for AsgardVault.addFiles, from bench/out/gas.json (hardhat receipts):
// single addFile ≈ 74.5k, each extra file in a batch ≈ 51.5k. A user's very first file also
// pays a zero->non-zero write of the array length (~17.1k). We pad by 10% for safety.
const (
	BaseGas         = 23_100
	PerFileGas      = 51_500
	FirstUploadGas  = 17_100
	safetyNumerator = 110
)

type Estimate struct {
	Files        int    `json:"files"`
	GasPriceWei  string `json:"gasPriceWei"`
	GasPerFile   uint64 `json:"gasPerFile"`
	TotalGas     uint64 `json:"totalGas"`
	TotalCostWei string `json:"totalCostWei"`
	CachedAt     string `json:"cachedAt"`
}

// Estimator caches eth_gasPrice for a short TTL so the UI can poll cheaply.
type Estimator struct {
	client *ethclient.Client
	ttl    time.Duration

	mu       sync.Mutex
	price    *big.Int
	cachedAt time.Time
}

func NewEstimator(client *ethclient.Client, ttl time.Duration) *Estimator {
	return &Estimator{client: client, ttl: ttl}
}

func (e *Estimator) gasPrice(ctx context.Context) (*big.Int, time.Time, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.price != nil && time.Since(e.cachedAt) < e.ttl {
		return e.price, e.cachedAt, nil
	}
	p, err := e.client.SuggestGasPrice(ctx)
	if err != nil {
		if e.price != nil { // serve stale on RPC hiccup
			return e.price, e.cachedAt, nil
		}
		return nil, time.Time{}, err
	}
	e.price, e.cachedAt = p, time.Now()
	return p, e.cachedAt, nil
}

func (e *Estimator) Estimate(ctx context.Context, files int, firstUpload bool) (Estimate, error) {
	price, at, err := e.gasPrice(ctx)
	if err != nil {
		return Estimate{}, err
	}
	total := uint64(BaseGas + PerFileGas*files)
	if firstUpload {
		total += FirstUploadGas
	}
	total = total * safetyNumerator / 100
	cost := new(big.Int).Mul(price, new(big.Int).SetUint64(total))
	return Estimate{
		Files:        files,
		GasPriceWei:  price.String(),
		GasPerFile:   PerFileGas * safetyNumerator / 100,
		TotalGas:     total,
		TotalCostWei: cost.String(),
		CachedAt:     at.UTC().Format(time.RFC3339),
	}, nil
}
