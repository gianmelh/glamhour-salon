BEGIN;

CREATE VIEW sales_history AS
SELECT
  a.id AS appointment_id,
  a.salon_id,
  a.client_id,
  c.full_name AS client_name,
  a.professional_id,
  p.full_name AS professional_name,
  a.starts_at,
  a.ends_at,
  a.status_code,
  af.subtotal_minor,
  af.discount_minor,
  af.tax_minor,
  af.tip_minor,
  af.total_minor,
  af.salon_earnings_minor,
  af.professional_earnings_minor,
  af.currency_code,
  af.recorded_at
FROM appointments a
JOIN clients c
  ON c.salon_id = a.salon_id
 AND c.id = a.client_id
JOIN professionals p
  ON p.salon_id = a.salon_id
 AND p.id = a.professional_id
JOIN appointment_financials af
  ON af.salon_id = a.salon_id
 AND af.appointment_id = a.id
WHERE a.status_code = 'completed';

CREATE VIEW public_booking_catalog AS
SELECT
  s.slug AS salon_slug,
  s.name AS salon_name,
  s.timezone,
  s.currency_code AS salon_currency_code,
  sc.code AS category_code,
  sc.name AS category_name,
  sv.id AS service_id,
  sv.name AS service_name,
  sv.description,
  sv.duration_minutes,
  sv.price_minor,
  sv.currency_code
FROM salons s
JOIN salon_settings ss
  ON ss.salon_id = s.id
JOIN services sv
  ON sv.salon_id = s.id
JOIN service_categories sc
  ON sc.id = sv.category_id
WHERE s.deleted_at IS NULL
  AND s.is_active
  AND s.booking_enabled
  AND ss.allow_public_booking
  AND sv.is_active
  AND sv.is_publicly_bookable
  AND sc.is_active;

COMMIT;
