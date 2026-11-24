// Package config loads runtime configuration from environment variables.
package config

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	HTTPAddr    string
	DatabaseURL string

	RPCURL          string
	ChainID         int64
	ContractAddress string
	StartBlock      uint64
	Confirmations   uint64
	IndexerBatch    uint64
	IndexerInterval time.Duration

	StorageProvider string // "kubo" | "pinata"
	KuboAPIURL      string
	PinataJWT       string
	GatewayURL      string // public gateway base the browser fetches from, e.g. "/ipfs/"

	JWTSecret      string
	SIWEDomain     string // optional; when set, SIWE messages must match it
	CookieSecure   bool
	CORSOrigins    []string
	MaxUploadBytes int64
}

// deployment mirrors packages/contracts/deployments/<chainId>.json.
type deployment struct {
	ChainID    int64  `json:"chainId"`
	Address    string `json:"address"`
	StartBlock uint64 `json:"startBlock"`
}

func Load() (*Config, error) {
	c := &Config{
		HTTPAddr:        env("HTTP_ADDR", ":8080"),
		DatabaseURL:     env("DATABASE_URL", "postgres://asgard:asgard@localhost:5432/asgard?sslmode=disable"),
		RPCURL:          env("RPC_URL", "http://localhost:8545"),
		ChainID:         int64(envUint("CHAIN_ID", 31337)),
		ContractAddress: os.Getenv("CONTRACT_ADDRESS"),
		StartBlock:      envUint("START_BLOCK", 0),
		Confirmations:   envUint("CONFIRMATIONS", 0),
		IndexerBatch:    envUint("INDEXER_BATCH", 500),
		IndexerInterval: time.Duration(envUint("INDEXER_INTERVAL_MS", 1500)) * time.Millisecond,
		StorageProvider: env("STORAGE_PROVIDER", "kubo"),
		KuboAPIURL:      env("KUBO_API_URL", "http://localhost:5001"),
		PinataJWT:       os.Getenv("PINATA_JWT"),
		GatewayURL:      env("GATEWAY_URL", "/ipfs/"),
		JWTSecret:       os.Getenv("JWT_SECRET"),
		SIWEDomain:      os.Getenv("SIWE_DOMAIN"),
		CookieSecure:    os.Getenv("COOKIE_SECURE") == "true",
		MaxUploadBytes:  int64(envUint("MAX_UPLOAD_MB", 25)) << 20,
	}
	if o := os.Getenv("CORS_ORIGINS"); o != "" {
		c.CORSOrigins = strings.Split(o, ",")
	}

	// A deployment file (written by the contracts deploy script) fills address/start block.
	if path := os.Getenv("DEPLOYMENT_FILE"); path != "" {
		raw, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("read deployment file: %w", err)
		}
		var d deployment
		if err := json.Unmarshal(raw, &d); err != nil {
			return nil, fmt.Errorf("parse deployment file: %w", err)
		}
		if c.ContractAddress == "" {
			c.ContractAddress = d.Address
		}
		if os.Getenv("START_BLOCK") == "" {
			c.StartBlock = d.StartBlock
		}
		if os.Getenv("CHAIN_ID") == "" && d.ChainID != 0 {
			c.ChainID = d.ChainID
		}
	}

	if c.ContractAddress == "" {
		return nil, fmt.Errorf("CONTRACT_ADDRESS or DEPLOYMENT_FILE is required")
	}
	if len(c.JWTSecret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET must be at least 32 characters")
	}
	if c.StorageProvider == "pinata" && c.PinataJWT == "" {
		return nil, fmt.Errorf("PINATA_JWT is required when STORAGE_PROVIDER=pinata")
	}
	return c, nil
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envUint(key string, def uint64) uint64 {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.ParseUint(v, 10, 64); err == nil {
			return n
		}
	}
	return def
}
