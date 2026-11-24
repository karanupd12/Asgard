CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Wallet addresses are stored lowercase hex ("0xabc...").

CREATE TABLE users (
    address        TEXT PRIMARY KEY,
    public_key     TEXT,                       -- X25519 public key (hex) for encrypted sharing
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE auth_nonces (
    nonce       TEXT PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per (owner, cid). Created as 'pending' by the upload endpoint, promoted to
-- 'confirmed' (or 'removed') by the indexer from on-chain events.
CREATE TABLE files (
    id             BIGSERIAL PRIMARY KEY,
    owner          TEXT NOT NULL,
    cid            TEXT NOT NULL,
    thumb_cid      TEXT,
    chain_file_id  BIGINT,
    status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','removed')),
    encrypted      BOOLEAN NOT NULL DEFAULT false,
    title          TEXT NOT NULL DEFAULT '',
    mime           TEXT NOT NULL DEFAULT '',
    size_bytes     BIGINT NOT NULL DEFAULT 0,
    width          INT,
    height         INT,
    tags           TEXT[] NOT NULL DEFAULT '{}',
    search         TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple', title)) STORED,
    tx_hash        TEXT,
    block_number   BIGINT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at   TIMESTAMPTZ,
    UNIQUE (owner, cid)
);

-- Gallery: newest-first keyset pagination per owner.
CREATE INDEX files_owner_id_idx   ON files (owner, id DESC) WHERE status <> 'removed';
-- Search: full-text on title, fuzzy (trigram) title, tag containment.
CREATE INDEX files_search_idx     ON files USING GIN (search);
CREATE INDEX files_title_trgm_idx ON files USING GIN (title gin_trgm_ops);
CREATE INDEX files_tags_idx       ON files USING GIN (tags);

CREATE TABLE albums (
    id          BIGSERIAL PRIMARY KEY,
    owner       TEXT NOT NULL,
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (owner, name)
);

CREATE TABLE album_files (
    album_id  BIGINT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    file_id   BIGINT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (album_id, file_id)
);
CREATE INDEX album_files_file_idx ON album_files (file_id);

-- Mirror of on-chain grants (source of truth: AsgardVault events).
CREATE TABLE access_grants (
    owner       TEXT NOT NULL,
    viewer      TEXT NOT NULL,
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (owner, viewer)
);
CREATE INDEX access_grants_viewer_idx ON access_grants (viewer);

-- Per-recipient wrapped (encrypted) file keys. Deleted on revoke.
CREATE TABLE file_keys (
    file_id      BIGINT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    recipient    TEXT NOT NULL,
    wrapped_key  TEXT NOT NULL,
    PRIMARY KEY (file_id, recipient)
);
CREATE INDEX file_keys_recipient_idx ON file_keys (recipient);

CREATE TABLE indexer_state (
    id          INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    next_block  BIGINT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
