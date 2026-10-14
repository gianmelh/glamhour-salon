BEGIN;

-- Verification belongs to a normalized address within one salon, not to a
-- mutable client record. A successful verification deliberately has no TTL.
CREATE TABLE public_booking_email_verifications (
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  email_normalized varchar(320) NOT NULL,
  verified_at timestamptz,
  active_code_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (salon_id, email_normalized),
  CHECK (email_normalized = lower(btrim(email_normalized)) AND email_normalized <> '')
);

-- Each reserved send is counted even when SMTP fails. Codes are only usable
-- after SMTP accepts the recipient; no plaintext code is persisted.
CREATE TABLE public_booking_email_codes (
  id uuid PRIMARY KEY,
  salon_id uuid NOT NULL,
  email_normalized varchar(320) NOT NULL,
  code_hash varchar(128),
  code_salt varchar(64),
  expires_at timestamptz NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  sent_at timestamptz,
  failed_at timestamptz,
  consumed_at timestamptz,
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  UNIQUE (salon_id, email_normalized, id),
  FOREIGN KEY (salon_id, email_normalized)
    REFERENCES public_booking_email_verifications (salon_id, email_normalized) ON DELETE CASCADE,
  CHECK ((code_hash IS NULL AND code_salt IS NULL)
      OR (code_hash IS NOT NULL AND code_salt IS NOT NULL
          AND code_hash ~ '^[a-f0-9]{128}$' AND code_salt ~ '^[a-f0-9]{64}$')),
  CHECK (sent_at IS NULL OR failed_at IS NULL)
);

ALTER TABLE public_booking_email_verifications
  ADD CONSTRAINT public_booking_email_active_code_fk
  FOREIGN KEY (salon_id, email_normalized, active_code_id)
  REFERENCES public_booking_email_codes (salon_id, email_normalized, id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX public_booking_email_codes_salon_requested_idx
  ON public_booking_email_codes (salon_id, requested_at DESC);
CREATE INDEX public_booking_email_codes_address_requested_idx
  ON public_booking_email_codes (salon_id, email_normalized, requested_at DESC);

COMMIT;
