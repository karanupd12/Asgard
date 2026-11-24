package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	CookieName = "asgard_session"
	sessionTTL = 24 * time.Hour
)

type ctxKey struct{}

// Tokens issues and verifies HS256 session JWTs whose subject is the wallet address.
type Tokens struct {
	secret []byte
}

func NewTokens(secret string) *Tokens { return &Tokens{secret: []byte(secret)} }

func (t *Tokens) Issue(address string) (string, time.Time, error) {
	exp := time.Now().Add(sessionTTL)
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		Subject:   address,
		IssuedAt:  jwt.NewNumericDate(time.Now()),
		ExpiresAt: jwt.NewNumericDate(exp),
	})
	s, err := tok.SignedString(t.secret)
	return s, exp, err
}

func (t *Tokens) Parse(s string) (string, error) {
	claims := &jwt.RegisteredClaims{}
	_, err := jwt.ParseWithClaims(s, claims, func(*jwt.Token) (any, error) { return t.secret, nil },
		jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired())
	if err != nil {
		return "", err
	}
	if claims.Subject == "" {
		return "", errors.New("empty subject")
	}
	return claims.Subject, nil
}

// Middleware resolves the session (cookie, or Bearer for scripts) and stores the address in ctx.
// It does not reject anonymous requests; use Require for that.
func (t *Tokens) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var raw string
		if c, err := r.Cookie(CookieName); err == nil {
			raw = c.Value
		} else if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
			raw = strings.TrimPrefix(h, "Bearer ")
		}
		if raw != "" {
			if addr, err := t.Parse(raw); err == nil {
				r = r.WithContext(context.WithValue(r.Context(), ctxKey{}, addr))
			}
		}
		next.ServeHTTP(w, r)
	})
}

func Require(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if Address(r.Context()) == "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte(`{"error":"sign in required"}`)) //nolint:errcheck
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Address returns the authenticated lowercase wallet address, or "".
func Address(ctx context.Context) string {
	v, _ := ctx.Value(ctxKey{}).(string)
	return v
}
