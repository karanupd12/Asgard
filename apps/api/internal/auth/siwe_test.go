package auth

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
)

func signedMessage(t *testing.T, chainID int64, issued time.Time) (*SIWEMessage, string) {
	t.Helper()
	key, _ := crypto.GenerateKey()
	addr := crypto.PubkeyToAddress(key.PublicKey)
	raw := fmt.Sprintf("localhost wants you to sign in with your Ethereum account:\n%s\n\nSign in to Asgard\n\nURI: http://localhost\nVersion: 1\nChain ID: %d\nNonce: abc123\nIssued At: %s",
		addr.Hex(), chainID, issued.UTC().Format(time.RFC3339))
	sig, err := crypto.Sign(accounts.TextHash([]byte(raw)), key)
	if err != nil {
		t.Fatal(err)
	}
	sig[64] += 27 // wallets return v in {27,28}
	m, err := ParseSIWE(raw)
	if err != nil {
		t.Fatal(err)
	}
	return m, hexutil.Encode(sig)
}

func TestSIWE(t *testing.T) {
	now := time.Now()

	t.Run("valid signature", func(t *testing.T) {
		m, sig := signedMessage(t, 31337, now)
		if err := VerifySignature(m, sig); err != nil {
			t.Fatalf("expected valid, got %v", err)
		}
		if err := m.Validate("localhost", 31337, now); err != nil {
			t.Fatalf("expected valid, got %v", err)
		}
		if m.Nonce != "abc123" {
			t.Fatalf("nonce = %q", m.Nonce)
		}
	})

	t.Run("tampered message is rejected", func(t *testing.T) {
		m, sig := signedMessage(t, 31337, now)
		m.Raw = strings.Replace(m.Raw, "abc123", "zzz999", 1)
		if err := VerifySignature(m, sig); err == nil {
			t.Fatal("expected signature failure")
		}
	})

	t.Run("wrong chain, wrong domain, stale", func(t *testing.T) {
		m, _ := signedMessage(t, 1, now)
		if err := m.Validate("", 31337, now); err == nil {
			t.Fatal("expected chain mismatch")
		}
		m, _ = signedMessage(t, 31337, now)
		if err := m.Validate("evil.com", 31337, now); err == nil {
			t.Fatal("expected domain mismatch")
		}
		m, _ = signedMessage(t, 31337, now.Add(-time.Hour))
		if err := m.Validate("", 31337, now); err == nil {
			t.Fatal("expected expiry")
		}
	})

	t.Run("malformed", func(t *testing.T) {
		for _, raw := range []string{"", "hello", "x wants you to sign in with your Ethereum account:\nnot-an-address"} {
			if _, err := ParseSIWE(raw); err == nil {
				t.Fatalf("expected error for %q", raw)
			}
		}
	})
}

func TestTokens(t *testing.T) {
	tk := NewTokens("0123456789abcdef0123456789abcdef")
	s, _, err := tk.Issue("0xabc")
	if err != nil {
		t.Fatal(err)
	}
	if addr, err := tk.Parse(s); err != nil || addr != "0xabc" {
		t.Fatalf("parse = %q, %v", addr, err)
	}
	other := NewTokens("ffffffffffffffffffffffffffffffff")
	if _, err := other.Parse(s); err == nil {
		t.Fatal("token signed with another secret must fail")
	}
}
