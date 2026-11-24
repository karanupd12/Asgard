package storage

import (
	"strings"
	"testing"
)

func TestCIDRoundTrip(t *testing.T) {
	// CIDv1 raw leaf (what Kubo returns with cid-version=1 for small files) round-trips exactly.
	const v1 = "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy"
	d, codec, err := ToDigest(v1)
	if err != nil {
		t.Fatal(err)
	}
	if codec != 0x55 {
		t.Fatalf("codec = 0x%x, want raw 0x55", codec)
	}
	if got, _ := FromDigest(d, codec); got != v1 {
		t.Fatalf("round trip = %s, want %s", got, v1)
	}

	// CIDv0 (dag-pb) normalises to a CIDv1 dag-pb ("bafybei...") with the same digest.
	const v0 = "QmYwAPJzv5CZsnAzt8auVZRn5W4bQ6Lz4b3GZy8JY3nH3o"
	d0, codec0, err := ToDigest(v0)
	if err != nil {
		t.Fatal(err)
	}
	norm, err := NormalizeCID(v0)
	if err != nil {
		t.Fatal(err)
	}
	if codec0 != 0x70 || !strings.HasPrefix(norm, "bafybei") {
		t.Fatalf("v0 normalised to %s (codec 0x%x)", norm, codec0)
	}
	d1, _, _ := ToDigest(norm)
	if d1 != d0 {
		t.Fatal("digest changed during normalisation")
	}

	if _, _, err := ToDigest("not-a-cid"); err == nil {
		t.Error("expected error for invalid cid")
	}
}
