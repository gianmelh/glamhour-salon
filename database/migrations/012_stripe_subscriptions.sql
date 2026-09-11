BEGIN;

ALTER TABLE salon_subscriptions
  DROP CONSTRAINT IF EXISTS salon_subscriptions_status_check;

ALTER TABLE salon_subscriptions
  ADD CONSTRAINT salon_subscriptions_status_check CHECK (
    status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'free')
  );

ALTER TABLE salon_subscriptions
  ADD COLUMN IF NOT EXISTS provider_price_id varchar(255);

CREATE UNIQUE INDEX IF NOT EXISTS salon_subscriptions_provider_subscription_idx
  ON salon_subscriptions (provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id varchar(255) PRIMARY KEY,
  event_type varchar(120) NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO subscription_plans (code, name, billing_interval, price_minor, currency_code, entitlements_json)
VALUES
  (
    'free',
    'Free',
    'none',
    0,
    'USD',
    '{"client_limit": 15, "appointment_management": true, "shareable_salon_link": true, "service_history": true, "team_dashboard": true}'::jsonb
  ),
  (
    'premium_monthly',
    'Monthly Premium',
    'month',
    1499,
    'USD',
    '{"unlimited_clients": true, "appointment_management": true, "shareable_salon_link": true, "service_history": true, "team_dashboard": true, "premium_features": true, "first_access": true, "priority_support": true}'::jsonb
  ),
  (
    'premium_annual',
    'Annual Premium',
    'year',
    11999,
    'USD',
    '{"unlimited_clients": true, "appointment_management": true, "shareable_salon_link": true, "service_history": true, "team_dashboard": true, "premium_features": true, "first_access": true, "priority_support": true}'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  billing_interval = EXCLUDED.billing_interval,
  price_minor = EXCLUDED.price_minor,
  currency_code = EXCLUDED.currency_code,
  entitlements_json = EXCLUDED.entitlements_json,
  is_active = true,
  updated_at = now();

INSERT INTO salon_subscriptions (salon_id, plan_id, provider, status)
SELECT s.id, p.id, 'stripe', 'free'
FROM salons s
CROSS JOIN subscription_plans p
WHERE p.code = 'free'
  AND s.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM salon_subscriptions ss
    WHERE ss.salon_id = s.id
      AND ss.status IN ('trialing', 'active', 'past_due', 'free')
  );

COMMIT;
