CREATE UNIQUE INDEX clients_salon_phone_unique
  ON clients (salon_id, regexp_replace(phone, '\D', '', 'g'))
  WHERE deleted_at IS NULL
    AND phone IS NOT NULL
    AND regexp_replace(phone, '\D', '', 'g') <> '';

CREATE UNIQUE INDEX clients_salon_email_unique
  ON clients (salon_id, lower(email))
  WHERE deleted_at IS NULL
    AND email IS NOT NULL
    AND btrim(email) <> '';
