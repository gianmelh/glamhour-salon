BEGIN;

INSERT INTO appointment_statuses (code, name, sort_order, is_terminal)
VALUES
  ('in_progress', 'In Progress', 30, false)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_terminal = EXCLUDED.is_terminal;

INSERT INTO appointment_status_transitions
  (from_status_code, to_status_code, allowed_actor_role)
VALUES
  ('scheduled', 'coming_up', 'owner'),
  ('scheduled', 'coming_up', 'admin'),
  ('scheduled', 'coming_up', 'professional'),
  ('scheduled', 'in_progress', 'professional'),
  ('scheduled', 'completed', 'professional'),
  ('scheduled', 'canceled', 'owner'),
  ('scheduled', 'canceled', 'admin'),
  ('scheduled', 'canceled', 'client'),
  ('coming_up', 'in_progress', 'professional'),
  ('coming_up', 'completed', 'professional'),
  ('coming_up', 'canceled', 'owner'),
  ('coming_up', 'canceled', 'admin'),
  ('coming_up', 'no_show', 'professional'),
  ('in_progress', 'completed', 'professional'),
  ('in_progress', 'canceled', 'owner')
ON CONFLICT (from_status_code, to_status_code, allowed_actor_role) DO NOTHING;

ALTER TABLE appointments
  ALTER COLUMN professional_id DROP NOT NULL;

COMMIT;
