-- Migration 009: prompt image cloud sync metadata
-- Adds stable client IDs and tombstones for optimized image sync.

ALTER TABLE prompt_images
  ADD COLUMN IF NOT EXISTS local_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE prompt_images
SET updated_at = created_at
WHERE updated_at IS NULL;

ALTER TABLE prompt_images
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_images_local_id_user
  ON prompt_images(auth_user_id, local_id)
  WHERE local_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prompt_images_auth_updated
  ON prompt_images(auth_user_id, updated_at ASC);
