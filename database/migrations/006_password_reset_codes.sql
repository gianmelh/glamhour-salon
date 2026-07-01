BEGIN;

CREATE TABLE password_reset_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT password_reset_codes_attempts_check CHECK (attempts >= 0)
);

CREATE INDEX password_reset_codes_user_active_idx
  ON password_reset_codes (user_id, created_at DESC)
  WHERE consumed_at IS NULL;

CREATE TRIGGER password_reset_codes_set_updated_at
  BEFORE UPDATE ON password_reset_codes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
