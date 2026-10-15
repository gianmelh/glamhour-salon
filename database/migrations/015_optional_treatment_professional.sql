BEGIN;

-- Quick bookings may remain unassigned (migration 010). Their clinical details
-- must also be saveable before a professional is selected. The existing
-- salon/professional foreign key continues to validate every non-null value.
ALTER TABLE treatment_records
  ALTER COLUMN professional_id DROP NOT NULL;

COMMIT;
