BEGIN;

-- Standalone client forms use the same questionnaires and version history as
-- appointment intake. Their snapshot is independent of any appointment.
ALTER TABLE health_questionnaires
  ADD COLUMN IF NOT EXISTS form_details_json jsonb,
  ADD COLUMN IF NOT EXISTS notes text;

COMMIT;
