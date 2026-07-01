BEGIN;

CREATE TABLE service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(60) NOT NULL UNIQUE,
  name varchar(100) NOT NULL,
  description text,
  icon_key varchar(100),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_categories_code_format CHECK (code ~ '^[a-z0-9_]+$')
);

CREATE TABLE salon_service_categories (
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (salon_id, category_id)
);

CREATE TABLE form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES service_categories(id) ON DELETE SET NULL,
  code varchar(100) NOT NULL,
  name varchar(160) NOT NULL,
  purpose varchar(30) NOT NULL,
  version integer NOT NULL DEFAULT 1,
  schema_json jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code, version),
  CONSTRAINT form_templates_purpose_check CHECK (purpose IN ('intake', 'health', 'consent', 'treatment')),
  CONSTRAINT form_templates_version_check CHECK (version > 0),
  CONSTRAINT form_templates_schema_object_check CHECK (jsonb_typeof(schema_json) = 'object')
);

CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
  form_template_id uuid REFERENCES form_templates(id) ON DELETE SET NULL,
  name varchar(160) NOT NULL,
  description text,
  duration_minutes integer NOT NULL,
  price_minor integer NOT NULL,
  currency_code char(3) NOT NULL DEFAULT 'USD',
  is_active boolean NOT NULL DEFAULT true,
  is_publicly_bookable boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, id),
  CONSTRAINT services_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT services_duration_check CHECK (duration_minutes > 0),
  CONSTRAINT services_price_check CHECK (price_minor >= 0),
  CONSTRAINT services_currency_check CHECK (currency_code ~ '^[A-Z]{3}$')
);

CREATE TABLE professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  full_name varchar(160) NOT NULL,
  email varchar(320),
  phone varchar(40),
  avatar_url text,
  languages text[] NOT NULL DEFAULT '{}',
  bio text,
  status varchar(30) NOT NULL DEFAULT 'active',
  is_owner boolean NOT NULL DEFAULT false,
  salon_earnings_percent numeric(5,2) NOT NULL DEFAULT 0,
  professional_earnings_percent numeric(5,2) NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (salon_id, id),
  CONSTRAINT professionals_name_not_blank CHECK (btrim(full_name) <> ''),
  CONSTRAINT professionals_status_check CHECK (status IN ('invited', 'active', 'inactive')),
  CONSTRAINT professionals_earnings_check CHECK (
    salon_earnings_percent BETWEEN 0 AND 100
    AND professional_earnings_percent BETWEEN 0 AND 100
    AND salon_earnings_percent + professional_earnings_percent = 100
  )
);

CREATE UNIQUE INDEX professionals_user_salon_unique_active
  ON professionals (salon_id, user_id)
  WHERE user_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE professional_services (
  professional_id uuid NOT NULL,
  salon_id uuid NOT NULL,
  service_id uuid NOT NULL,
  duration_override_minutes integer,
  price_override_minor integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (professional_id, service_id),
  FOREIGN KEY (salon_id, professional_id) REFERENCES professionals(salon_id, id) ON DELETE CASCADE,
  FOREIGN KEY (salon_id, service_id) REFERENCES services(salon_id, id) ON DELETE CASCADE,
  CONSTRAINT professional_services_duration_check CHECK (
    duration_override_minutes IS NULL OR duration_override_minutes > 0
  ),
  CONSTRAINT professional_services_price_check CHECK (
    price_override_minor IS NULL OR price_override_minor >= 0
  )
);

CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  full_name varchar(160) NOT NULL,
  email varchar(320),
  phone varchar(40),
  date_of_birth date,
  preferred_language varchar(10),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (salon_id, id),
  CONSTRAINT clients_name_not_blank CHECK (btrim(full_name) <> '')
);

CREATE INDEX clients_salon_name_idx ON clients (salon_id, lower(full_name));
CREATE INDEX clients_salon_phone_idx ON clients (salon_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX clients_salon_email_idx ON clients (salon_id, lower(email)) WHERE email IS NOT NULL;

CREATE TABLE client_health_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL,
  client_id uuid NOT NULL,
  allergies text,
  medications text,
  conditions text,
  notes text,
  responses_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_at timestamptz,
  reviewed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id),
  FOREIGN KEY (salon_id, client_id) REFERENCES clients(salon_id, id) ON DELETE CASCADE,
  CONSTRAINT client_health_responses_object_check CHECK (jsonb_typeof(responses_json) = 'object')
);

CREATE TABLE client_form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL,
  client_id uuid NOT NULL,
  form_template_id uuid NOT NULL REFERENCES form_templates(id) ON DELETE RESTRICT,
  appointment_id uuid,
  submitted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status varchar(20) NOT NULL DEFAULT 'draft',
  answers_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, id),
  FOREIGN KEY (salon_id, client_id) REFERENCES clients(salon_id, id) ON DELETE CASCADE,
  CONSTRAINT client_form_status_check CHECK (status IN ('draft', 'submitted', 'superseded')),
  CONSTRAINT client_form_answers_object_check CHECK (jsonb_typeof(answers_json) = 'object')
);

CREATE INDEX services_salon_category_idx ON services (salon_id, category_id, is_active);
CREATE INDEX professionals_salon_status_idx ON professionals (salon_id, status);
CREATE INDEX professional_services_service_idx ON professional_services (salon_id, service_id, is_active);
CREATE INDEX client_forms_client_idx ON client_form_submissions (salon_id, client_id, created_at DESC);

CREATE TRIGGER service_categories_set_updated_at BEFORE UPDATE ON service_categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER salon_service_categories_set_updated_at BEFORE UPDATE ON salon_service_categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER form_templates_set_updated_at BEFORE UPDATE ON form_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER services_set_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER professionals_set_updated_at BEFORE UPDATE ON professionals FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER professional_services_set_updated_at BEFORE UPDATE ON professional_services FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER clients_set_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER client_health_profiles_set_updated_at BEFORE UPDATE ON client_health_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER client_form_submissions_set_updated_at BEFORE UPDATE ON client_form_submissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
