-- Migration 002: prompts and prompt_images (Neon DB — server-side copy)
-- These rows are owned by a profile (auth_user_id).
-- Only synced rows appear here; local-only prompts live in IndexedDB only.

CREATE TABLE IF NOT EXISTS prompts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id          TEXT NOT NULL,          -- Dexie UUID (client-side key)
  auth_user_id      TEXT NOT NULL,          -- neon_auth.users.id
  title             TEXT NOT NULL DEFAULT '',
  description       TEXT NOT NULL DEFAULT '',
  content           TEXT NOT NULL DEFAULT '',
  content_type      TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'json', 'markdown')),
  type              TEXT NOT NULL DEFAULT 'other' CHECK (type IN ('image_generation', 'image_editing', 'other')),
  model             TEXT NOT NULL DEFAULT '',
  tags              TEXT[] NOT NULL DEFAULT '{}',
  is_favorite       BOOLEAN NOT NULL DEFAULT FALSE,
  order_index       NUMERIC NOT NULL DEFAULT 0,
  copy_count        INTEGER NOT NULL DEFAULT 0,
  base_version      INTEGER NOT NULL DEFAULT 1,
  is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
  collection_id     UUID REFERENCES collections(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prompts_local_id_user
  ON prompts(local_id, auth_user_id);

CREATE INDEX IF NOT EXISTS idx_prompts_auth_user_id ON prompts(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_updated_at  ON prompts(auth_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_tags        ON prompts USING gin(tags);

-- ─── prompt_images ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS prompt_images (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id        UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  auth_user_id     TEXT NOT NULL,
  image_type       TEXT NOT NULL CHECK (image_type IN ('original', 'optimized')),
  -- Store image as base64 data URL (optimized 720p WebP/JPEG, max ~1.5MB)
  data_url         TEXT NOT NULL,
  sha256           TEXT NOT NULL,
  width            INTEGER,
  height           INTEGER,
  format           TEXT,
  size_bytes       INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prompt_images_prompt_id ON prompt_images(prompt_id);
