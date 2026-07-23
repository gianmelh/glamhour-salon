BEGIN;

CREATE TABLE IF NOT EXISTS health_questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  appointment_id uuid,
  category_id uuid REFERENCES service_categories(id) ON DELETE RESTRICT,
  questionnaire_type varchar(80) NOT NULL,
  version integer NOT NULL DEFAULT 1,
  status varchar(30) NOT NULL DEFAULT 'draft',
  completed_at timestamptz,
  expires_at timestamptz,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, id),
  FOREIGN KEY (salon_id, client_id) REFERENCES clients(salon_id, id) ON DELETE CASCADE,
  FOREIGN KEY (salon_id, appointment_id) REFERENCES appointments(salon_id, id) ON DELETE CASCADE,
  CONSTRAINT health_questionnaires_status_check CHECK (status IN ('draft', 'completed', 'superseded', 'expired')),
  CONSTRAINT health_questionnaires_version_check CHECK (version > 0)
);

CREATE TABLE IF NOT EXISTS health_questionnaire_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id uuid NOT NULL REFERENCES health_questionnaires(id) ON DELETE CASCADE,
  question_key varchar(160) NOT NULL,
  answer_type varchar(30) NOT NULL,
  boolean_value boolean,
  text_value text,
  numeric_value numeric,
  json_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (questionnaire_id, question_key),
  CONSTRAINT health_answers_type_check CHECK (answer_type IN ('boolean', 'text', 'number', 'json')),
  CONSTRAINT health_answers_json_object_check CHECK (json_value IS NULL OR jsonb_typeof(json_value) IN ('object', 'array', 'string', 'number', 'boolean'))
);

ALTER TABLE consent_records
  ADD COLUMN IF NOT EXISTS questionnaire_id uuid REFERENCES health_questionnaires(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS consent_type varchar(80),
  ADD COLUMN IF NOT EXISTS consent_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS accepted boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_text_snapshot text;

CREATE TABLE IF NOT EXISTS signature_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  appointment_id uuid,
  questionnaire_id uuid REFERENCES health_questionnaires(id) ON DELETE SET NULL,
  signature_type varchar(80) NOT NULL,
  signer_name varchar(160) NOT NULL,
  signature_data text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, id),
  FOREIGN KEY (salon_id, client_id) REFERENCES clients(salon_id, id) ON DELETE CASCADE,
  FOREIGN KEY (salon_id, appointment_id) REFERENCES appointments(salon_id, id) ON DELETE CASCADE,
  CONSTRAINT signature_type_check CHECK (
    signature_type IN ('client_consent', 'professional_signature', 'design_approval', 'photography_consent')
  )
);

CREATE TABLE IF NOT EXISTS treatment_visual_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  appointment_id uuid,
  category varchar(60) NOT NULL,
  body_area varchar(80),
  annotation_type varchar(80) NOT NULL,
  x_position numeric(8,4),
  y_position numeric(8,4),
  width numeric(8,4),
  height numeric(8,4),
  path_data text,
  points_json jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, id),
  FOREIGN KEY (salon_id, client_id) REFERENCES clients(salon_id, id) ON DELETE CASCADE,
  FOREIGN KEY (salon_id, appointment_id) REFERENCES appointments(salon_id, id) ON DELETE CASCADE,
  CONSTRAINT treatment_annotations_points_check CHECK (points_json IS NULL OR jsonb_typeof(points_json) IN ('object', 'array'))
);

CREATE TABLE IF NOT EXISTS appointment_category_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL,
  category varchar(60) NOT NULL,
  details_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, appointment_id, category),
  FOREIGN KEY (salon_id, appointment_id) REFERENCES appointments(salon_id, id) ON DELETE CASCADE,
  CONSTRAINT appointment_category_details_object_check CHECK (jsonb_typeof(details_json) = 'object')
);

CREATE TABLE IF NOT EXISTS health_profile_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  category varchar(60) NOT NULL,
  questionnaire_id uuid REFERENCES health_questionnaires(id) ON DELETE SET NULL,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'active',
  superseded_by_id uuid REFERENCES health_profile_versions(id) ON DELETE SET NULL,
  medical_change_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, id),
  FOREIGN KEY (salon_id, client_id) REFERENCES clients(salon_id, id) ON DELETE CASCADE,
  CONSTRAINT health_profile_versions_status_check CHECK (status IN ('active', 'expired', 'superseded'))
);

CREATE INDEX IF NOT EXISTS health_questionnaires_client_idx
  ON health_questionnaires (salon_id, client_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS health_questionnaires_category_idx
  ON health_questionnaires (salon_id, client_id, category_id, status);
CREATE INDEX IF NOT EXISTS signature_records_appointment_idx
  ON signature_records (salon_id, appointment_id, signature_type);
CREATE INDEX IF NOT EXISTS treatment_annotations_appointment_idx
  ON treatment_visual_annotations (salon_id, appointment_id, category);
CREATE INDEX IF NOT EXISTS appointment_category_details_appointment_idx
  ON appointment_category_details (salon_id, appointment_id, category);
CREATE INDEX IF NOT EXISTS health_profile_versions_client_category_idx
  ON health_profile_versions (salon_id, client_id, category, status, valid_until DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'health_questionnaires_set_updated_at'
  ) THEN
    CREATE TRIGGER health_questionnaires_set_updated_at
      BEFORE UPDATE ON health_questionnaires
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'health_questionnaire_answers_set_updated_at'
  ) THEN
    CREATE TRIGGER health_questionnaire_answers_set_updated_at
      BEFORE UPDATE ON health_questionnaire_answers
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'signature_records_set_updated_at'
  ) THEN
    CREATE TRIGGER signature_records_set_updated_at
      BEFORE UPDATE ON signature_records
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'treatment_visual_annotations_set_updated_at'
  ) THEN
    CREATE TRIGGER treatment_visual_annotations_set_updated_at
      BEFORE UPDATE ON treatment_visual_annotations
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'appointment_category_details_set_updated_at'
  ) THEN
    CREATE TRIGGER appointment_category_details_set_updated_at
      BEFORE UPDATE ON appointment_category_details
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'health_profile_versions_set_updated_at'
  ) THEN
    CREATE TRIGGER health_profile_versions_set_updated_at
      BEFORE UPDATE ON health_profile_versions
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

COMMIT;
