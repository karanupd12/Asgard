// Package chain exposes the AsgardVault ABI (exported from packages/contracts).
package chain

import (
	_ "embed"
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
)

//go:embed abi.json
var abiJSON string

// VaultABI is the parsed AsgardVault ABI. Regenerate with `pnpm --filter @asgard/contracts compile`.
var VaultABI = mustParse(abiJSON)

func mustParse(s string) abi.ABI {
	a, err := abi.JSON(strings.NewReader(s))
	if err != nil {
		panic("invalid embedded ABI: " + err.Error())
	}
	return a
}
