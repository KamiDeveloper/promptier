-- Migration 006: templates
-- Editable prompt templates backed up through manual sync.

CREATE TABLE IF NOT EXISTS templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id      TEXT NOT NULL,
  auth_user_id  TEXT NOT NULL,
  name          TEXT NOT NULL CHECK (length(name) >= 1 AND length(name) <= 120),
  content       TEXT NOT NULL DEFAULT '',
  content_type  TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'json', 'markdown')),
  tags          TEXT[] NOT NULL DEFAULT '{}',
  is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_local_id_user
  ON templates(local_id, auth_user_id);

CREATE INDEX IF NOT EXISTS idx_templates_auth_user_id
  ON templates(auth_user_id);

CREATE INDEX IF NOT EXISTS idx_templates_tags
  ON templates USING gin(tags);
