-- Migration 003: collections (must be created before prompts references it)
-- One level deep max: a collection with a parent_id CANNOT be set as parent.

CREATE TABLE IF NOT EXISTS collections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id      TEXT NOT NULL,
  auth_user_id  TEXT NOT NULL,
  name          TEXT NOT NULL CHECK (length(name) >= 1 AND length(name) <= 100),
  parent_id     UUID REFERENCES collections(id) ON DELETE SET NULL,
  is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_local_id_user
  ON collections(local_id, auth_user_id);

CREATE INDEX IF NOT EXISTS idx_collections_auth_user_id ON collections(auth_user_id);

-- Enforce max one-level nesting via trigger
CREATE OR REPLACE FUNCTION check_collection_depth()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM collections
      WHERE id = NEW.parent_id AND parent_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Collections can only be one level deep.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_collection_depth
  BEFORE INSERT OR UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION check_collection_depth();
