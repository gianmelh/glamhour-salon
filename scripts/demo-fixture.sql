-- Only applied by start-legal-demo.mts AFTER checking a newly created private
-- cluster. This is not a migration and must never be run against another DB.
BEGIN;
UPDATE salons SET name = 'GlamHour Demo Legal', slug = 'demo-legal',
  email = 'salon@example.test', phone = '+1-202-555-0100',
  address_line_1 = 'Calle ficticia 123', city = 'Ciudad Demo', region = 'Demo',
  latitude = NULL, longitude = NULL;
UPDATE users SET email = 'usuario' || right(id::text, 1) || '@example.test',
  full_name = 'Profesional Demo ' || right(id::text, 1), avatar_url = NULL,
  phone = '+1-202-555-010' || right(id::text, 1);
UPDATE professionals SET email = 'profesional' || right(id::text, 1) || '@example.test',
  full_name = 'Profesional Demo ' || right(id::text, 1), avatar_url = NULL,
  phone = '+1-202-555-011' || right(id::text, 1), bio = 'Profesional ficticio para revisión legal';
UPDATE clients SET email = 'cliente' || right(id::text, 1) || '@example.test',
  full_name = 'Cliente Demo ' || right(id::text, 1),
  phone = '+1-202-555-012' || right(id::text, 1), notes = 'Registro ficticio. No corresponde a una persona real.';
UPDATE salon_subscriptions SET provider = 'mock_store', provider_customer_id = NULL,
  provider_subscription_id = NULL, current_period_start = now(), current_period_end = now() + interval '1 year';
-- Shift upcoming fixtures onto today's local calendar and completed examples
-- into the last 30 days, keeping dates coherent across their financial records.
UPDATE appointments SET starts_at = starts_at + (current_date - date '2026-03-18') * interval '1 day',
  ends_at = ends_at + (current_date - date '2026-03-18') * interval '1 day'
  WHERE status_code <> 'completed';
UPDATE appointments SET starts_at = starts_at + (current_date - 2 - date '2025-12-28') * interval '1 day',
  ends_at = ends_at + (current_date - 2 - date '2025-12-28') * interval '1 day',
  created_at = created_at + (current_date - 2 - date '2025-12-28') * interval '1 day'
  WHERE status_code = 'completed';
UPDATE treatment_records SET completed_at = completed_at + (current_date - 2 - date '2025-12-28') * interval '1 day';
UPDATE appointment_financials SET recorded_at = recorded_at + (current_date - 2 - date '2025-12-28') * interval '1 day';
UPDATE payments SET paid_at = paid_at + (current_date - 2 - date '2025-12-28') * interval '1 day';
UPDATE invoices SET issued_at = issued_at + (current_date - 2 - date '2025-12-28') * interval '1 day',
  paid_at = paid_at + (current_date - 2 - date '2025-12-28') * interval '1 day';
UPDATE receipts SET issued_at = issued_at + (current_date - 2 - date '2025-12-28') * interval '1 day',
  delivery_email = 'cliente' || right(id::text, 1) || '@example.test';
UPDATE appointment_status_history h SET changed_at = h.changed_at + (current_date - 2 - date '2025-12-28') * interval '1 day'
  FROM appointments a WHERE a.id = h.appointment_id AND a.status_code = 'completed';
UPDATE appointment_events e SET created_at = e.created_at + (current_date - 2 - date '2025-12-28') * interval '1 day'
  FROM appointments a WHERE a.id = e.appointment_id AND a.status_code = 'completed';
UPDATE consent_records SET signed_at = signed_at + (current_date - 2 - date '2025-12-28') * interval '1 day',
  professional_signed_at = professional_signed_at + (current_date - 2 - date '2025-12-28') * interval '1 day';
UPDATE client_form_submissions SET submitted_at = submitted_at + (current_date - 2 - date '2025-12-28') * interval '1 day';
UPDATE notifications SET recipient = CASE WHEN channel = 'email' THEN 'cliente8@example.test' ELSE NULL END,
  body = 'Notificación ficticia de la demo; no se ha enviado ningún mensaje externo.';
INSERT INTO public_booking_email_verifications(salon_id, email_normalized, verified_at)
VALUES ('10000000-0000-0000-0000-000000000001', 'cliente8@example.test', now());
COMMIT;
