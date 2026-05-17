-- Migration 005: sync_operations (server-side operation log for idempotent sync)
-- Stores completed operation IDs to ensure idempotency during push sync.

CREATE TABLE IF NOT EXISTS sync_operations (
  operation_id    TEXT PRIMARY KEY,     -- UUID from client outbox
  auth_user_id    TEXT NOT NULL,
  entity_type     TEXT NOT NULL,        -- 'prompt' | 'collection' | 'prompt_image'
  operation       TEXT NOT NULL,        -- 'upsert' | 'delete'
  applied_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_ops_user ON sync_operations(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_sync_ops_applied ON sync_operations(auth_user_id, applied_at DESC);

-- Auto-clean operations older than 30 days (keep idempotency window)
-- Run as a periodic job (pg_cron or external scheduler)
-- DELETE FROM sync_operations WHERE applied_at < NOW() - INTERVAL '30 days';
