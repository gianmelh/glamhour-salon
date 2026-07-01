BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_provider varchar(50) NOT NULL DEFAULT 'email',
  auth_provider_subject varchar(255),
  email varchar(320) NOT NULL,
  password_hash text,
  full_name varchar(160) NOT NULL,
  phone varchar(40),
  avatar_url text,
  locale varchar(10) NOT NULL DEFAULT 'en',
  is_platform_admin boolean NOT NULL DEFAULT false,
  email_verified_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT users_email_not_blank CHECK (btrim(email) <> ''),
  CONSTRAINT users_full_name_not_blank CHECK (btrim(full_name) <> '')
);

CREATE UNIQUE INDEX users_email_unique_active
  ON users (lower(email))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX users_auth_identity_unique
  ON users (auth_provider, auth_provider_subject)
  WHERE auth_provider_subject IS NOT NULL;

CREATE TABLE salons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(160) NOT NULL,
  slug varchar(120) NOT NULL UNIQUE,
  email varchar(320),
  phone varchar(40),
  timezone varchar(100) NOT NULL DEFAULT 'America/New_York',
  currency_code char(3) NOT NULL DEFAULT 'USD',
  locale varchar(10) NOT NULL DEFAULT 'en',
  address_line_1 varchar(255),
  address_line_2 varchar(255),
  city varchar(120),
  region varchar(120),
  postal_code varchar(30),
  country_code char(2),
  latitude numeric(9,6),
  longitude numeric(9,6),
  verification_status varchar(30) NOT NULL DEFAULT 'pending',
  onboarding_status varchar(30) NOT NULL DEFAULT 'not_started',
  onboarding_step varchar(80),
  booking_enabled boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT salons_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT salons_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT salons_currency_format CHECK (currency_code ~ '^[A-Z]{3}$'),
  CONSTRAINT salons_country_format CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT salons_verification_status_check CHECK (
    verification_status IN ('pending', 'under_review', 'verified', 'rejected')
  ),
  CONSTRAINT salons_onboarding_status_check CHECK (
    onboarding_status IN ('not_started', 'in_progress', 'completed')
  )
);

CREATE TABLE salon_owners (
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false,
  ownership_percent numeric(5,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (salon_id, user_id),
  CONSTRAINT salon_owners_percent_check CHECK (
    ownership_percent IS NULL OR ownership_percent BETWEEN 0 AND 100
  )
);

CREATE UNIQUE INDEX salon_primary_owner_unique
  ON salon_owners (salon_id)
  WHERE is_primary;

CREATE TABLE salon_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(30) NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'active',
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, user_id),
  CONSTRAINT salon_membership_role_check CHECK (role IN ('owner', 'admin', 'professional', 'receptionist')),
  CONSTRAINT salon_membership_status_check CHECK (status IN ('invited', 'active', 'disabled'))
);

CREATE TABLE salon_verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  uploaded_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  document_type varchar(80) NOT NULL,
  storage_key text NOT NULL,
  original_filename text,
  mime_type varchar(150),
  review_status varchar(30) NOT NULL DEFAULT 'pending',
  rejection_reason text,
  reviewed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salon_verification_review_status_check CHECK (
    review_status IN ('pending', 'approved', 'rejected')
  )
);

CREATE TABLE legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type varchar(30) NOT NULL,
  version varchar(30) NOT NULL,
  title varchar(200) NOT NULL,
  body text NOT NULL,
  published_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_type, version),
  CONSTRAINT legal_document_type_check CHECK (document_type IN ('terms', 'privacy'))
);

CREATE TABLE legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  salon_id uuid REFERENCES salons(id) ON DELETE CASCADE,
  legal_document_id uuid NOT NULL REFERENCES legal_documents(id) ON DELETE RESTRICT,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, salon_id, legal_document_id)
);

CREATE TABLE onboarding_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL UNIQUE REFERENCES salons(id) ON DELETE CASCADE,
  current_step varchar(80) NOT NULL,
  completed_steps text[] NOT NULL DEFAULT '{}',
  draft_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_draft_object_check CHECK (jsonb_typeof(draft_data) = 'object')
);

CREATE TABLE salon_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL UNIQUE REFERENCES salons(id) ON DELETE CASCADE,
  appointment_interval_minutes integer NOT NULL DEFAULT 15,
  minimum_booking_notice_minutes integer NOT NULL DEFAULT 60,
  maximum_booking_days_ahead integer NOT NULL DEFAULT 90,
  cancellation_notice_minutes integer NOT NULL DEFAULT 1440,
  allow_public_booking boolean NOT NULL DEFAULT false,
  require_booking_confirmation boolean NOT NULL DEFAULT false,
  settings_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salon_settings_interval_check CHECK (appointment_interval_minutes > 0),
  CONSTRAINT salon_settings_notice_check CHECK (
    minimum_booking_notice_minutes >= 0
    AND maximum_booking_days_ahead > 0
    AND cancellation_notice_minutes >= 0
  ),
  CONSTRAINT salon_settings_json_object_check CHECK (jsonb_typeof(settings_json) = 'object')
);

CREATE TABLE user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  theme varchar(20) NOT NULL DEFAULT 'system',
  locale varchar(10) NOT NULL DEFAULT 'en',
  timezone varchar(100),
  settings_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_settings_theme_check CHECK (theme IN ('light', 'dark', 'system')),
  CONSTRAINT user_settings_json_object_check CHECK (jsonb_typeof(settings_json) = 'object')
);

CREATE INDEX salon_memberships_user_idx ON salon_memberships (user_id, status);
CREATE INDEX salon_verification_documents_salon_idx ON salon_verification_documents (salon_id, review_status);
CREATE INDEX legal_acceptances_user_idx ON legal_acceptances (user_id, accepted_at DESC);

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER salons_set_updated_at BEFORE UPDATE ON salons FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER salon_owners_set_updated_at BEFORE UPDATE ON salon_owners FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER salon_memberships_set_updated_at BEFORE UPDATE ON salon_memberships FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER salon_verification_documents_set_updated_at BEFORE UPDATE ON salon_verification_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER legal_documents_set_updated_at BEFORE UPDATE ON legal_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER legal_acceptances_set_updated_at BEFORE UPDATE ON legal_acceptances FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER onboarding_sessions_set_updated_at BEFORE UPDATE ON onboarding_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER salon_settings_set_updated_at BEFORE UPDATE ON salon_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER user_settings_set_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
