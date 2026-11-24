// Package storage pins content to IPFS through a pluggable provider.
package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"
)

// Provider pins a stream to IPFS and returns its CID. Implementations must stream
// (never buffer the whole file) so memory stays flat regardless of upload size.
type Provider interface {
	Name() string
	Add(ctx context.Context, filename string, r io.Reader) (cid string, err error)
}

var httpClient = &http.Client{Timeout: 5 * time.Minute}

// streamMultipart POSTs r as a multipart "file" field without buffering it in memory.
func streamMultipart(ctx context.Context, url, filename string, r io.Reader, extra map[string]string,
	headers map[string]string, out any) error {
	pr, pw := io.Pipe()
	mw := multipart.NewWriter(pw)

	go func() {
		err := func() error {
			for k, v := range extra {
				if err := mw.WriteField(k, v); err != nil {
					return err
				}
			}
			part, err := mw.CreateFormFile("file", filename)
			if err != nil {
				return err
			}
			if _, err := io.Copy(part, r); err != nil {
				return err
			}
			return mw.Close()
		}()
		pw.CloseWithError(err)
	}()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, pr)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", mw.FormDataContentType())
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return fmt.Errorf("ipfs provider: %s: %s", resp.Status, body)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// ---------------------------------------------------------------- Kubo (local IPFS)

type Kubo struct{ apiURL string }

func NewKubo(apiURL string) *Kubo { return &Kubo{apiURL: apiURL} }

func (k *Kubo) Name() string { return "kubo" }

func (k *Kubo) Add(ctx context.Context, filename string, r io.Reader) (string, error) {
	var out struct{ Hash string }
	err := streamMultipart(ctx, k.apiURL+"/api/v0/add?cid-version=1&pin=true&quieter=true",
		filename, r, nil, nil, &out)
	if err != nil {
		return "", err
	}
	return out.Hash, nil
}

// ---------------------------------------------------------------- Pinata (hosted)

type Pinata struct{ jwt string }

func NewPinata(jwt string) *Pinata { return &Pinata{jwt: jwt} }

func (p *Pinata) Name() string { return "pinata" }

func (p *Pinata) Add(ctx context.Context, filename string, r io.Reader) (string, error) {
	var out struct{ IpfsHash string }
	err := streamMultipart(ctx, "https://api.pinata.cloud/pinning/pinFileToIPFS", filename, r,
		map[string]string{"pinataOptions": `{"cidVersion":1}`},
		map[string]string{"Authorization": "Bearer " + p.jwt}, &out)
	if err != nil {
		return "", err
	}
	return out.IpfsHash, nil
}
