BEGIN;

-- Keep appointment and treatment foreign keys intact while removing a service
-- from the editable catalog. Availability (is_active) remains independent.
ALTER TABLE services ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMIT;
