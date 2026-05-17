-- Migration 004: public_prompts
-- Published snapshots visible to all users.
-- authorNickname is the ONLY user identifier stored publicly.

CREATE TABLE IF NOT EXISTS public_prompts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
  author_user_id   TEXT NOT NULL,          -- for RLS / owner checks
  author_nickname  TEXT NOT NULL,          -- ONLY identifier shown publicly
  title            TEXT NOT NULL DEFAULT '',
  description      TEXT NOT NULL DEFAULT '',
  content          TEXT NOT NULL DEFAULT '',
  content_type     TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'json', 'markdown')),
  type             TEXT NOT NULL DEFAULT 'other' CHECK (type IN ('image_generation', 'image_editing', 'other')),
  model            TEXT NOT NULL DEFAULT '',
  tags             TEXT[] NOT NULL DEFAULT '{}',
  optimized_image_url TEXT,
  is_deleted       BOOLEAN NOT NULL DEFAULT FALSE,
  published_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_prompts_published_at ON public_prompts(published_at DESC)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_public_prompts_author ON public_prompts(author_user_id);
CREATE INDEX IF NOT EXISTS idx_public_prompts_tags   ON public_prompts USING gin(tags);

-- ─── public_prompt_images ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public_prompt_images (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_prompt_id UUID NOT NULL REFERENCES public_prompts(id) ON DELETE CASCADE,
  image_type       TEXT NOT NULL CHECK (image_type IN ('original', 'optimized')),
  data_url         TEXT NOT NULL,
  sha256           TEXT NOT NULL,
  width            INTEGER,
  height           INTEGER,
  format           TEXT,
  size_bytes       INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_prompt_images_prompt ON public_prompt_images(public_prompt_id);
