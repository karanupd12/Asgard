// Package auth implements Sign-In With Ethereum (EIP-4361) and session tokens.
package auth

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
)

// SIWEMessage holds the fields of an EIP-4361 message that the server checks.
type SIWEMessage struct {
	Domain   string
	Address  common.Address
	ChainID  int64
	Nonce    string
	IssuedAt time.Time
	Raw      string
}

var (
	ErrMalformed    = errors.New("malformed SIWE message")
	ErrBadSignature = errors.New("signature does not match address")
	ErrExpired      = errors.New("SIWE message too old")
)

// ParseSIWE extracts the fields we verify from an EIP-4361 message:
//
//	{domain} wants you to sign in with your Ethereum account:
//	{address}
//	...
//	Chain ID: {chainId}
//	Nonce: {nonce}
//	Issued At: {RFC3339}
func ParseSIWE(raw string) (*SIWEMessage, error) {
	lines := strings.Split(strings.ReplaceAll(raw, "\r\n", "\n"), "\n")
	if len(lines) < 2 {
		return nil, ErrMalformed
	}
	const suffix = " wants you to sign in with your Ethereum account:"
	if !strings.HasSuffix(lines[0], suffix) {
		return nil, ErrMalformed
	}
	m := &SIWEMessage{Domain: strings.TrimSuffix(lines[0], suffix), Raw: raw}

	addr := strings.TrimSpace(lines[1])
	if !common.IsHexAddress(addr) {
		return nil, fmt.Errorf("%w: bad address", ErrMalformed)
	}
	m.Address = common.HexToAddress(addr)

	for _, l := range lines[2:] {
		switch {
		case strings.HasPrefix(l, "Chain ID: "):
			id, err := strconv.ParseInt(strings.TrimPrefix(l, "Chain ID: "), 10, 64)
			if err != nil {
				return nil, fmt.Errorf("%w: bad chain id", ErrMalformed)
			}
			m.ChainID = id
		case strings.HasPrefix(l, "Nonce: "):
			m.Nonce = strings.TrimPrefix(l, "Nonce: ")
		case strings.HasPrefix(l, "Issued At: "):
			t, err := time.Parse(time.RFC3339Nano, strings.TrimPrefix(l, "Issued At: "))
			if err != nil {
				return nil, fmt.Errorf("%w: bad issued-at", ErrMalformed)
			}
			m.IssuedAt = t
		}
	}
	if m.Nonce == "" || m.ChainID == 0 || m.IssuedAt.IsZero() {
		return nil, fmt.Errorf("%w: missing nonce, chain id or issued-at", ErrMalformed)
	}
	return m, nil
}

// VerifySignature checks an EIP-191 personal_sign signature over the raw message.
// (EIP-1271 smart-contract wallets are not supported.)
func VerifySignature(m *SIWEMessage, sigHex string) error {
	sig, err := hexutil.Decode(sigHex)
	if err != nil || len(sig) != 65 {
		return ErrBadSignature
	}
	sig = append([]byte(nil), sig...)
	if sig[64] >= 27 {
		sig[64] -= 27
	}
	pub, err := crypto.SigToPub(accounts.TextHash([]byte(m.Raw)), sig)
	if err != nil {
		return ErrBadSignature
	}
	if crypto.PubkeyToAddress(*pub) != m.Address {
		return ErrBadSignature
	}
	return nil
}

// Validate checks domain, chain and freshness. Nonce single-use is enforced by the caller.
func (m *SIWEMessage) Validate(domain string, chainID int64, now time.Time) error {
	if domain != "" && m.Domain != domain {
		return fmt.Errorf("%w: domain mismatch", ErrMalformed)
	}
	if m.ChainID != chainID {
		return fmt.Errorf("%w: wrong chain id %d", ErrMalformed, m.ChainID)
	}
	if now.Sub(m.IssuedAt) > 10*time.Minute || m.IssuedAt.Sub(now) > time.Minute {
		return ErrExpired
	}
	return nil
}
