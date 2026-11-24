package storage

import (
	"fmt"

	"github.com/ipfs/go-cid"
	mh "github.com/multiformats/go-multihash"
)

// ToDigest converts a CID into the (sha2-256 digest, multicodec) pair stored on-chain.
// Only sha2-256 CIDs are accepted (the default for Kubo and Pinata).
func ToDigest(s string) (digest [32]byte, codec uint64, err error) {
	c, err := cid.Decode(s)
	if err != nil {
		return digest, 0, fmt.Errorf("decode cid: %w", err)
	}
	dec, err := mh.Decode(c.Hash())
	if err != nil {
		return digest, 0, err
	}
	if dec.Code != mh.SHA2_256 || len(dec.Digest) != 32 {
		return digest, 0, fmt.Errorf("unsupported multihash 0x%x (need sha2-256)", dec.Code)
	}
	copy(digest[:], dec.Digest)
	return digest, c.Type(), nil
}

// FromDigest rebuilds the canonical CIDv1 (base32) string from on-chain data.
func FromDigest(digest [32]byte, codec uint64) (string, error) {
	hash, err := mh.Encode(digest[:], mh.SHA2_256)
	if err != nil {
		return "", err
	}
	return cid.NewCidV1(codec, hash).String(), nil
}

// NormalizeCID returns the canonical CIDv1 form so DB keys match what the indexer rebuilds.
func NormalizeCID(s string) (string, error) {
	d, codec, err := ToDigest(s)
	if err != nil {
		return "", err
	}
	return FromDigest(d, codec)
}
