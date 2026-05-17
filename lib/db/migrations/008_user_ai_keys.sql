-- Migration 008: BYOK Gemini keys and AI usage counters

CREATE TABLE IF NOT EXISTS user_ai_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('gemini')),
  encrypted_key BYTEA NOT NULL,
  iv BYTEA NOT NULL,
  auth_tag BYTEA NOT NULL,
  key_fingerprint TEXT NOT NULL,
  key_preview TEXT NOT NULL,
  encryption_kid TEXT NOT NULL,
  thinking_level TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (
    thinking_level IN ('MINIMAL', 'LOW', 'MEDIUM', 'HIGH')
  ),
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'revoked', 'invalid')
  ),
  last_used_at TIMESTAMPTZ,
  last_validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (auth_user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_ai_keys_auth_user_id
  ON user_ai_keys(auth_user_id);

CREATE TABLE IF NOT EXISTS ai_usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('gemini')),
  usage_source TEXT NOT NULL CHECK (usage_source IN ('shared', 'byok')),
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (auth_user_id, provider, usage_source, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_user_date
  ON ai_usage_daily(auth_user_id, usage_date DESC);
