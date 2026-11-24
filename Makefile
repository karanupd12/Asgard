# Thin wrapper over the pnpm scripts in package.json (use `pnpm <target>` on Windows without make).
.PHONY: up down test e2e seed bench screenshots diagram go-test

up:          ; docker compose up --build -d
down:        ; docker compose down
test:        ; pnpm test && $(MAKE) go-test
e2e:         ; pnpm e2e
seed:        ; pnpm seed
bench:       ; pnpm bench
screenshots: ; pnpm screenshots
diagram:     ; pnpm diagram
go-test:     ; docker run --rm -v "$(CURDIR)/apps/api:/src" -w /src golang:1.23-alpine go test ./...
