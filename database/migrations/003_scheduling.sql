BEGIN;

CREATE TABLE appointment_statuses (
  code varchar(30) PRIMARY KEY,
  name varchar(80) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_terminal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE appointment_status_transitions (
  from_status_code varchar(30) NOT NULL REFERENCES appointment_statuses(code) ON DELETE CASCADE,
  to_status_code varchar(30) NOT NULL REFERENCES appointment_statuses(code) ON DELETE CASCADE,
  allowed_actor_role varchar(30) NOT NULL DEFAULT 'any',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (from_status_code, to_status_code, allowed_actor_role),
  CONSTRAINT appointment_status_transition_role_check CHECK (
    allowed_actor_role IN ('any', 'owner', 'admin', 'professional', 'receptionist', 'client', 'system')
  ),
  CONSTRAINT appointment_status_transition_change_check CHECK (from_status_code <> to_status_code)
);

CREATE TABLE salon_working_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL,
  is_open boolean NOT NULL DEFAULT true,
  opens_at time,
  closes_at time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, day_of_week),
  CONSTRAINT salon_working_hours_day_check CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT salon_working_hours_time_check CHECK (
    (NOT is_open AND opens_at IS NULL AND closes_at IS NULL)
    OR (is_open AND opens_at IS NOT NULL AND closes_at IS NOT NULL AND opens_at < closes_at)
  )
);

CREATE TABLE professional_working_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  day_of_week smallint NOT NULL,
  is_working boolean NOT NULL DEFAULT true,
  starts_at time,
  ends_at time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (professional_id, day_of_week),
  FOREIGN KEY (salon_id, professional_id) REFERENCES professionals(salon_id, id) ON DELETE CASCADE,
  CONSTRAINT professional_working_hours_day_check CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT professional_working_hours_time_check CHECK (
    (NOT is_working AND starts_at IS NULL AND ends_at IS NULL)
    OR (is_working AND starts_at IS NOT NULL AND ends_at IS NOT NULL AND starts_at < ends_at)
  )
);

CREATE TABLE availability_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  professional_id uuid,
  exception_type varchar(30) NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (salon_id, professional_id) REFERENCES professionals(salon_id, id) ON DELETE CASCADE,
  CONSTRAINT availability_exception_type_check CHECK (
    exception_type IN ('blocked', 'available_override', 'time_off', 'holiday')
  ),
  CONSTRAINT availability_exception_range_check CHECK (starts_at < ends_at)
);

CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  status_code varchar(30) NOT NULL REFERENCES appointment_statuses(code) ON DELETE RESTRICT,
  source varchar(30) NOT NULL DEFAULT 'internal',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  customer_notes text,
  internal_notes text,
  cancellation_reason text,
  canceled_at timestamptz,
  canceled_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  rescheduled_from_appointment_id uuid,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, id),
  FOREIGN KEY (salon_id, client_id) REFERENCES clients(salon_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (salon_id, professional_id) REFERENCES professionals(salon_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (salon_id, rescheduled_from_appointment_id) REFERENCES appointments(salon_id, id) ON DELETE RESTRICT,
  CONSTRAINT appointments_source_check CHECK (source IN ('internal', 'public_booking', 'rebook')),
  CONSTRAINT appointments_range_check CHECK (starts_at < ends_at),
  CONSTRAINT appointments_cancellation_check CHECK (
    (status_code <> 'canceled') OR canceled_at IS NOT NULL
  )
);

ALTER TABLE client_form_submissions
  ADD CONSTRAINT client_form_appointment_fk
  FOREIGN KEY (salon_id, appointment_id)
  REFERENCES appointments(salon_id, id)
  ON DELETE RESTRICT;

CREATE TABLE appointment_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL,
  appointment_id uuid NOT NULL,
  service_id uuid NOT NULL,
  service_name_snapshot varchar(160) NOT NULL,
  category_code_snapshot varchar(60) NOT NULL,
  duration_minutes_snapshot integer NOT NULL,
  unit_price_minor integer NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  status_code varchar(30) NOT NULL DEFAULT 'scheduled' REFERENCES appointment_statuses(code) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, id),
  FOREIGN KEY (salon_id, appointment_id) REFERENCES appointments(salon_id, id) ON DELETE CASCADE,
  FOREIGN KEY (salon_id, service_id) REFERENCES services(salon_id, id) ON DELETE RESTRICT,
  CONSTRAINT appointment_services_duration_check CHECK (duration_minutes_snapshot > 0),
  CONSTRAINT appointment_services_price_check CHECK (unit_price_minor >= 0),
  CONSTRAINT appointment_services_quantity_check CHECK (quantity > 0)
);

CREATE TABLE appointment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL,
  appointment_id uuid NOT NULL,
  event_type varchar(50) NOT NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  from_status_code varchar(30) REFERENCES appointment_statuses(code) ON DELETE RESTRICT,
  to_status_code varchar(30) REFERENCES appointment_statuses(code) ON DELETE RESTRICT,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (salon_id, appointment_id) REFERENCES appointments(salon_id, id) ON DELETE CASCADE,
  CONSTRAINT appointment_events_metadata_object_check CHECK (jsonb_typeof(metadata_json) = 'object')
);

CREATE TABLE appointment_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL,
  appointment_id uuid NOT NULL,
  status_code varchar(30) NOT NULL REFERENCES appointment_statuses(code) ON DELETE RESTRICT,
  changed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (salon_id, appointment_id) REFERENCES appointments(salon_id, id) ON DELETE CASCADE
);

ALTER TABLE appointments
  ADD CONSTRAINT appointments_no_professional_overlap
  EXCLUDE USING gist (
    professional_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (status_code NOT IN ('canceled', 'completed', 'no_show'));

CREATE INDEX salon_working_hours_salon_idx ON salon_working_hours (salon_id, day_of_week);
CREATE INDEX professional_working_hours_professional_idx ON professional_working_hours (professional_id, day_of_week);
CREATE INDEX availability_exceptions_professional_time_idx ON availability_exceptions (professional_id, starts_at, ends_at);
CREATE INDEX appointments_salon_start_idx ON appointments (salon_id, starts_at);
CREATE INDEX appointments_professional_start_idx ON appointments (professional_id, starts_at);
CREATE INDEX appointments_client_start_idx ON appointments (client_id, starts_at DESC);
CREATE INDEX appointment_services_appointment_idx ON appointment_services (appointment_id);
CREATE INDEX appointment_events_appointment_idx ON appointment_events (appointment_id, created_at DESC);
CREATE INDEX appointment_status_history_appointment_idx ON appointment_status_history (appointment_id, changed_at DESC);

CREATE TRIGGER appointment_statuses_set_updated_at BEFORE UPDATE ON appointment_statuses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER appointment_status_transitions_set_updated_at BEFORE UPDATE ON appointment_status_transitions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER salon_working_hours_set_updated_at BEFORE UPDATE ON salon_working_hours FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER professional_working_hours_set_updated_at BEFORE UPDATE ON professional_working_hours FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER availability_exceptions_set_updated_at BEFORE UPDATE ON availability_exceptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER appointments_set_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER appointment_services_set_updated_at BEFORE UPDATE ON appointment_services FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER appointment_events_set_updated_at BEFORE UPDATE ON appointment_events FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER appointment_status_history_set_updated_at BEFORE UPDATE ON appointment_status_history FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
