BEGIN;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_no_client_overlap
  EXCLUDE USING gist (
    client_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (status_code NOT IN ('canceled', 'completed', 'no_show'));

COMMIT;
