BEGIN;

CREATE TABLE consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL,
  client_id uuid NOT NULL,
  appointment_id uuid NOT NULL,
  form_submission_id uuid,
  client_signature_storage_key text,
  professional_signature_storage_key text,
  signed_at timestamptz NOT NULL,
  professional_signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (salon_id, client_id) REFERENCES clients(salon_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (salon_id, appointment_id) REFERENCES appointments(salon_id, id) ON DELETE CASCADE,
  FOREIGN KEY (salon_id, form_submission_id) REFERENCES client_form_submissions(salon_id, id) ON DELETE RESTRICT
);

CREATE TABLE treatment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL,
  appointment_service_id uuid NOT NULL UNIQUE,
  client_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  category_code varchar(60) NOT NULL,
  form_template_id uuid REFERENCES form_templates(id) ON DELETE SET NULL,
  form_template_version integer,
  details_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  recommendations text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (salon_id, client_id) REFERENCES clients(salon_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (salon_id, professional_id) REFERENCES professionals(salon_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (salon_id, appointment_service_id) REFERENCES appointment_services(salon_id, id) ON DELETE CASCADE,
  CONSTRAINT treatment_records_details_object_check CHECK (jsonb_typeof(details_json) = 'object')
);

CREATE TABLE treatment_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_record_id uuid NOT NULL REFERENCES treatment_records(id) ON DELETE CASCADE,
  media_type varchar(30) NOT NULL,
  storage_key text NOT NULL,
  mime_type varchar(150),
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT treatment_media_type_check CHECK (
    media_type IN ('reference', 'before', 'after', 'diagram', 'signature', 'other')
  ),
  CONSTRAINT treatment_media_metadata_object_check CHECK (jsonb_typeof(metadata_json) = 'object')
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL,
  appointment_id uuid NOT NULL,
  client_id uuid NOT NULL,
  payment_provider varchar(50),
  provider_payment_id varchar(255),
  method varchar(30) NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'pending',
  amount_minor integer NOT NULL,
  tip_minor integer NOT NULL DEFAULT 0,
  currency_code char(3) NOT NULL DEFAULT 'USD',
  paid_at timestamptz,
  refunded_at timestamptz,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, id),
  FOREIGN KEY (salon_id, appointment_id) REFERENCES appointments(salon_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (salon_id, client_id) REFERENCES clients(salon_id, id) ON DELETE RESTRICT,
  CONSTRAINT payments_method_check CHECK (method IN ('cash', 'card', 'bank_transfer', 'digital_wallet', 'other')),
  CONSTRAINT payments_status_check CHECK (status IN ('pending', 'authorized', 'paid', 'partially_refunded', 'refunded', 'failed', 'voided')),
  CONSTRAINT payments_amount_check CHECK (amount_minor >= 0 AND tip_minor >= 0),
  CONSTRAINT payments_currency_check CHECK (currency_code ~ '^[A-Z]{3}$'),
  CONSTRAINT payments_metadata_object_check CHECK (jsonb_typeof(metadata_json) = 'object')
);

CREATE UNIQUE INDEX payments_provider_id_unique
  ON payments (payment_provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE TABLE appointment_financials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL,
  appointment_id uuid NOT NULL,
  subtotal_minor integer NOT NULL,
  discount_minor integer NOT NULL DEFAULT 0,
  tax_minor integer NOT NULL DEFAULT 0,
  tip_minor integer NOT NULL DEFAULT 0,
  total_minor integer NOT NULL,
  salon_earnings_minor integer NOT NULL,
  professional_earnings_minor integer NOT NULL,
  currency_code char(3) NOT NULL DEFAULT 'USD',
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id),
  FOREIGN KEY (salon_id, appointment_id) REFERENCES appointments(salon_id, id) ON DELETE RESTRICT,
  CONSTRAINT appointment_financials_amount_check CHECK (
    subtotal_minor >= 0
    AND discount_minor >= 0
    AND tax_minor >= 0
    AND tip_minor >= 0
    AND total_minor >= 0
    AND salon_earnings_minor >= 0
    AND professional_earnings_minor >= 0
    AND total_minor = subtotal_minor - discount_minor + tax_minor + tip_minor
  ),
  CONSTRAINT appointment_financials_currency_check CHECK (currency_code ~ '^[A-Z]{3}$')
);

CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL,
  appointment_id uuid NOT NULL,
  client_id uuid NOT NULL,
  invoice_number varchar(80) NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'issued',
  subtotal_minor integer NOT NULL,
  discount_minor integer NOT NULL DEFAULT 0,
  tax_minor integer NOT NULL DEFAULT 0,
  tip_minor integer NOT NULL DEFAULT 0,
  total_minor integer NOT NULL,
  currency_code char(3) NOT NULL DEFAULT 'USD',
  issued_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, invoice_number),
  UNIQUE (salon_id, id),
  FOREIGN KEY (salon_id, appointment_id) REFERENCES appointments(salon_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (salon_id, client_id) REFERENCES clients(salon_id, id) ON DELETE RESTRICT,
  CONSTRAINT invoices_status_check CHECK (status IN ('draft', 'issued', 'paid', 'voided')),
  CONSTRAINT invoices_amount_check CHECK (
    subtotal_minor >= 0
    AND discount_minor >= 0
    AND tax_minor >= 0
    AND tip_minor >= 0
    AND total_minor = subtotal_minor - discount_minor + tax_minor + tip_minor
  ),
  CONSTRAINT invoices_currency_check CHECK (currency_code ~ '^[A-Z]{3}$')
);

CREATE TABLE receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL,
  payment_id uuid NOT NULL,
  receipt_number varchar(80) NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  delivery_email varchar(320),
  storage_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, receipt_number),
  UNIQUE (payment_id),
  FOREIGN KEY (salon_id, invoice_id) REFERENCES invoices(salon_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (salon_id, payment_id) REFERENCES payments(salon_id, id) ON DELETE RESTRICT
);

CREATE TABLE invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL,
  appointment_service_id uuid,
  description varchar(255) NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price_minor integer NOT NULL,
  line_total_minor integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (salon_id, invoice_id) REFERENCES invoices(salon_id, id) ON DELETE CASCADE,
  FOREIGN KEY (salon_id, appointment_service_id) REFERENCES appointment_services(salon_id, id) ON DELETE RESTRICT,
  CONSTRAINT invoice_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT invoice_items_amount_check CHECK (
    unit_price_minor >= 0
    AND line_total_minor = quantity * unit_price_minor
  )
);

CREATE TABLE payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  amount_minor integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_id, invoice_id),
  FOREIGN KEY (salon_id, payment_id) REFERENCES payments(salon_id, id) ON DELETE CASCADE,
  FOREIGN KEY (salon_id, invoice_id) REFERENCES invoices(salon_id, id) ON DELETE RESTRICT,
  CONSTRAINT payment_allocations_amount_check CHECK (amount_minor > 0)
);

CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL,
  appointment_id uuid NOT NULL,
  client_id uuid NOT NULL,
  professional_id uuid,
  rating smallint NOT NULL,
  comment text,
  is_public boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, client_id),
  FOREIGN KEY (salon_id, appointment_id) REFERENCES appointments(salon_id, id) ON DELETE CASCADE,
  FOREIGN KEY (salon_id, client_id) REFERENCES clients(salon_id, id) ON DELETE CASCADE,
  FOREIGN KEY (salon_id, professional_id) REFERENCES professionals(salon_id, id) ON DELETE RESTRICT,
  CONSTRAINT reviews_rating_check CHECK (rating BETWEEN 1 AND 5)
);

CREATE TABLE notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  channel varchar(20) NOT NULL,
  event_type varchar(80) NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, user_id, channel, event_type),
  CONSTRAINT notification_preferences_channel_check CHECK (channel IN ('email', 'sms', 'push', 'whatsapp', 'in_app'))
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  client_id uuid,
  appointment_id uuid,
  channel varchar(20) NOT NULL,
  event_type varchar(80) NOT NULL,
  recipient varchar(320),
  title text,
  body text NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'queued',
  scheduled_for timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  provider_message_id varchar(255),
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (salon_id, client_id) REFERENCES clients(salon_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (salon_id, appointment_id) REFERENCES appointments(salon_id, id) ON DELETE RESTRICT,
  CONSTRAINT notifications_channel_check CHECK (channel IN ('email', 'sms', 'push', 'whatsapp', 'in_app')),
  CONSTRAINT notifications_status_check CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'read', 'canceled')),
  CONSTRAINT notifications_metadata_object_check CHECK (jsonb_typeof(metadata_json) = 'object')
);

CREATE TABLE subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(80) NOT NULL UNIQUE,
  name varchar(120) NOT NULL,
  billing_interval varchar(20) NOT NULL,
  price_minor integer NOT NULL,
  currency_code char(3) NOT NULL DEFAULT 'USD',
  entitlements_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_plans_interval_check CHECK (billing_interval IN ('month', 'year', 'none')),
  CONSTRAINT subscription_plans_price_check CHECK (price_minor >= 0),
  CONSTRAINT subscription_plans_entitlements_object_check CHECK (jsonb_typeof(entitlements_json) = 'object')
);

CREATE TABLE salon_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  provider varchar(50),
  provider_customer_id varchar(255),
  provider_subscription_id varchar(255),
  status varchar(30) NOT NULL,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salon_subscriptions_status_check CHECK (
    status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'free')
  )
);

CREATE UNIQUE INDEX salon_subscriptions_one_current_idx
  ON salon_subscriptions (salon_id)
  WHERE status IN ('trialing', 'active', 'past_due', 'free');

CREATE INDEX treatment_records_client_idx ON treatment_records (salon_id, client_id, created_at DESC);
CREATE INDEX treatment_media_record_idx ON treatment_media (treatment_record_id);
CREATE INDEX payments_appointment_idx ON payments (appointment_id, status);
CREATE INDEX invoices_client_idx ON invoices (salon_id, client_id, issued_at DESC);
CREATE INDEX invoice_items_invoice_idx ON invoice_items (invoice_id);
CREATE INDEX payment_allocations_invoice_idx ON payment_allocations (invoice_id);
CREATE INDEX reviews_salon_public_idx ON reviews (salon_id, published_at DESC) WHERE is_public;
CREATE INDEX notifications_scheduled_idx ON notifications (status, scheduled_for) WHERE status = 'queued';

CREATE TRIGGER consent_records_set_updated_at BEFORE UPDATE ON consent_records FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER treatment_records_set_updated_at BEFORE UPDATE ON treatment_records FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER treatment_media_set_updated_at BEFORE UPDATE ON treatment_media FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER payments_set_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER appointment_financials_set_updated_at BEFORE UPDATE ON appointment_financials FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER invoices_set_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER receipts_set_updated_at BEFORE UPDATE ON receipts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER invoice_items_set_updated_at BEFORE UPDATE ON invoice_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER payment_allocations_set_updated_at BEFORE UPDATE ON payment_allocations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER reviews_set_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER notification_preferences_set_updated_at BEFORE UPDATE ON notification_preferences FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER notifications_set_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER subscription_plans_set_updated_at BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER salon_subscriptions_set_updated_at BEFORE UPDATE ON salon_subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
