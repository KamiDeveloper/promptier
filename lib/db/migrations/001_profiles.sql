-- Migration 001: profiles
-- Users table is managed by Neon Auth in the `neon_auth` schema.
-- This table stores app-specific profile data (nickname) linked by auth user id.

CREATE TABLE IF NOT EXISTS profiles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id TEXT NOT NULL UNIQUE,  -- neon_auth.users.id
  nickname     TEXT NOT NULL UNIQUE CHECK (
    length(nickname) >= 3
    AND length(nickname) <= 32
    AND nickname ~ '^[a-zA-Z0-9_-]+$'
  ),
  nickname_normalized TEXT GENERATED ALWAYS AS (lower(nickname)) STORED UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for lookups by auth_user_id
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON profiles(auth_user_id);
