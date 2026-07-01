-- Glamhour Phase 2 mockup seed data.
-- Apply after every migration in database/migrations.
-- Intended for a clean local/development database.

BEGIN;

-- Stable IDs make the dataset predictable for future API and UI development.
-- Salon: Glow Salon
-- Owner: Sarah Johnson

-- Reference data -------------------------------------------------------------

INSERT INTO appointment_statuses (code, name, sort_order, is_terminal) VALUES
  ('scheduled', 'Scheduled', 10, false),
  ('coming_up', 'Coming Up', 20, false),
  ('in_progress', 'In Progress', 30, false),
  ('completed', 'Completed', 40, true),
  ('canceled', 'Canceled', 50, true),
  ('no_show', 'No Show', 60, true);

INSERT INTO appointment_status_transitions
  (from_status_code, to_status_code, allowed_actor_role)
VALUES
  ('scheduled', 'coming_up', 'owner'),
  ('scheduled', 'coming_up', 'admin'),
  ('scheduled', 'coming_up', 'professional'),
  ('scheduled', 'canceled', 'owner'),
  ('scheduled', 'canceled', 'admin'),
  ('scheduled', 'canceled', 'client'),
  ('coming_up', 'in_progress', 'professional'),
  ('coming_up', 'completed', 'professional'),
  ('coming_up', 'canceled', 'owner'),
  ('coming_up', 'canceled', 'admin'),
  ('coming_up', 'no_show', 'professional'),
  ('in_progress', 'completed', 'professional'),
  ('in_progress', 'canceled', 'owner');

INSERT INTO service_categories
  (id, code, name, description, icon_key, sort_order)
VALUES
  ('50000000-0000-0000-0000-000000000001', 'nails', 'Nails', 'Manicures, pedicures, acrylics, and nail art.', 'nails', 10),
  ('50000000-0000-0000-0000-000000000002', 'lashes', 'Lashes', 'Eyelash extensions, lifts, and tinting services.', 'lashes', 20),
  ('50000000-0000-0000-0000-000000000003', 'cosmetology', 'Cosmetology', 'Facials, skincare treatments, and beauty enhancements.', 'cosmetology', 30),
  ('50000000-0000-0000-0000-000000000004', 'micropigmentation', 'Micropigmentation', 'Microblading, lip liner, eyeliner, and permanent makeup.', 'micropigmentation', 40);

INSERT INTO legal_documents
  (id, document_type, version, title, body, published_at, is_active)
VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    'terms',
    '2026-03-01',
    'Terms & Conditions',
    'Mockup development terms covering account responsibilities, service use, payment, liability, termination, and governing law.',
    '2026-03-01 12:00:00+00',
    true
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'privacy',
    '2026-03-01',
    'Privacy Policy',
    'Mockup development privacy policy covering information collection, use, storage, client data, retention, and user rights.',
    '2026-03-01 12:00:00+00',
    true
  );

INSERT INTO subscription_plans
  (id, code, name, billing_interval, price_minor, currency_code, entitlements_json)
VALUES
  (
    'a1000000-0000-0000-0000-000000000001',
    'free',
    'Free',
    'none',
    0,
    'USD',
    '{"appointment_management": true, "service_management": true, "professional_limit": 1}'::jsonb
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'premium_monthly',
    'Monthly Premium',
    'month',
    1499,
    'USD',
    '{"unlimited_clients": true, "unlimited_professionals": true, "sales_history": true, "public_booking": true, "notifications": true}'::jsonb
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'premium_annual',
    'Annual Premium',
    'year',
    9999,
    'USD',
    '{"unlimited_clients": true, "unlimited_professionals": true, "sales_history": true, "public_booking": true, "notifications": true}'::jsonb
  );

-- Users, salon, ownership, settings, and onboarding --------------------------

INSERT INTO users
  (id, auth_provider, auth_provider_subject, email, password_hash, full_name, phone, avatar_url, email_verified_at, last_login_at)
VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    'email',
    'mock-sarah-johnson',
    'sarah@glowsalon.example',
    crypt('GlamhourDemo2026!', gen_salt('bf')),
    'Sarah Johnson',
    '+1-305-555-0101',
    '/mock/avatars/sarah-johnson.jpg',
    '2025-11-01 14:00:00+00',
    '2026-03-18 12:45:00+00'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'email',
    'mock-maria-garcia',
    'maria@glowsalon.example',
    crypt('GlamhourDemo2026!', gen_salt('bf')),
    'Maria Garcia',
    '+1-305-555-0102',
    '/mock/avatars/maria-garcia.jpg',
    '2025-11-02 14:00:00+00',
    '2026-03-18 12:30:00+00'
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    'email',
    'mock-emily-chen',
    'emily@glowsalon.example',
    crypt('GlamhourDemo2026!', gen_salt('bf')),
    'Emily Chen',
    '+1-305-555-0103',
    '/mock/avatars/emily-chen.jpg',
    '2025-11-03 14:00:00+00',
    '2026-03-17 19:00:00+00'
  );

INSERT INTO salons
  (
    id, name, slug, email, phone, timezone, currency_code, locale,
    address_line_1, city, region, postal_code, country_code, latitude, longitude,
    verification_status, onboarding_status, onboarding_step, booking_enabled
  )
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    'Glow Salon',
    'glow-salon',
    'hello@glowsalon.example',
    '+1-305-555-0199',
    'America/New_York',
    'USD',
    'en',
    '1234 Biscayne Blvd',
    'Miami',
    'FL',
    '33132',
    'US',
    25.787700,
    -80.189200,
    'verified',
    'completed',
    'complete',
    true
  );

INSERT INTO salon_owners (salon_id, user_id, is_primary, ownership_percent) VALUES
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', true, 100.00);

INSERT INTO salon_memberships
  (id, salon_id, user_id, role, status, invited_at, joined_at)
VALUES
  ('21000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'owner', 'active', '2025-11-01 14:00:00+00', '2025-11-01 14:05:00+00'),
  ('21000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'professional', 'active', '2025-11-02 14:00:00+00', '2025-11-02 15:00:00+00'),
  ('21000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'professional', 'active', '2025-11-03 14:00:00+00', '2025-11-03 15:00:00+00');

INSERT INTO salon_verification_documents
  (id, salon_id, uploaded_by_user_id, document_type, storage_key, original_filename, mime_type, review_status, reviewed_by_user_id, reviewed_at)
VALUES
  (
    'a2000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'proof_of_ownership',
    'salon-verification/glow-salon/badge-5-5.png',
    'Badge-5-5.png',
    'image/png',
    'approved',
    '20000000-0000-0000-0000-000000000001',
    '2025-11-01 15:00:00+00'
  );

INSERT INTO legal_acceptances
  (id, user_id, salon_id, legal_document_id, accepted_at, ip_address, user_agent)
VALUES
  ('a3000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '2025-11-01 14:10:00+00', '127.0.0.1', 'Glamhour mockup seed'),
  ('a3000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', '2025-11-01 14:11:00+00', '127.0.0.1', 'Glamhour mockup seed');

INSERT INTO onboarding_sessions
  (id, salon_id, current_step, completed_steps, draft_data, started_at, completed_at)
VALUES
  (
    'a4000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'complete',
    ARRAY['service_categories', 'services', 'weekly_schedule', 'team_and_providers'],
    '{"selected_categories": ["nails", "lashes", "cosmetology", "micropigmentation"], "source": "figma_mockup"}'::jsonb,
    '2025-11-01 15:05:00+00',
    '2025-11-01 16:00:00+00'
  );

INSERT INTO salon_settings
  (
    id, salon_id, appointment_interval_minutes, minimum_booking_notice_minutes,
    maximum_booking_days_ahead, cancellation_notice_minutes, allow_public_booking,
    require_booking_confirmation, settings_json
  )
VALUES
  (
    'a5000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    15,
    60,
    120,
    1440,
    true,
    false,
    '{"booking_link": "glamhour.app/book/glow-salon", "social_share_enabled": true}'::jsonb
  );

INSERT INTO user_settings (id, user_id, theme, locale, timezone, settings_json) VALUES
  ('a6000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'light', 'en', 'America/New_York', '{"home_default_range": "week"}'::jsonb),
  ('a6000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'light', 'en', 'America/New_York', '{}'::jsonb),
  ('a6000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'light', 'en', 'America/New_York', '{}'::jsonb);

INSERT INTO salon_subscriptions
  (id, salon_id, plan_id, provider, provider_customer_id, provider_subscription_id, status, current_period_start, current_period_end)
VALUES
  (
    'a7000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000002',
    'mock_store',
    'cus_glow_salon',
    'sub_glow_premium_monthly',
    'active',
    '2026-03-01 05:00:00+00',
    '2026-04-01 04:00:00+00'
  );

-- Form templates -------------------------------------------------------------

INSERT INTO form_templates
  (id, category_id, code, name, purpose, version, schema_json)
VALUES
  (
    '90000000-0000-0000-0000-000000000001',
    NULL,
    'general_health_intake',
    'Health Questionnaire',
    'health',
    1,
    '{"sections": ["general_information", "medical_history", "habits", "informed_consent"]}'::jsonb
  ),
  (
    '90000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000001',
    'nails_treatment',
    'Nails Service Details',
    'treatment',
    1,
    '{"fields": ["system", "shape", "materials", "hand", "fingers"]}'::jsonb
  ),
  (
    '90000000-0000-0000-0000-000000000003',
    '50000000-0000-0000-0000-000000000002',
    'lashes_treatment',
    'Lashes Service Details',
    'treatment',
    1,
    '{"fields": ["style", "eye_shape", "volume", "curl", "thickness", "length", "reference_photo"]}'::jsonb
  ),
  (
    '90000000-0000-0000-0000-000000000004',
    '50000000-0000-0000-0000-000000000003',
    'cosmetology_treatment',
    'Aesthetic Treatment Clinical Form',
    'treatment',
    1,
    '{"fields": ["skin_assessment", "facial_annotations", "equipment", "products", "recommendations"]}'::jsonb
  ),
  (
    '90000000-0000-0000-0000-000000000005',
    '50000000-0000-0000-0000-000000000004',
    'micropigmentation_treatment',
    'Micropigmentation Clinical Form',
    'treatment',
    1,
    '{"fields": ["area", "skin_tone", "procedure_details", "pigment", "control", "recommendations"]}'::jsonb
  ),
  (
    '90000000-0000-0000-0000-000000000006',
    NULL,
    'service_informed_consent',
    'Informed Consent',
    'consent',
    1,
    '{"statements": ["procedure_explained", "risks_acknowledged", "aftercare_acknowledged", "data_processing_accepted"]}'::jsonb
  );

-- Catalog and professionals --------------------------------------------------

INSERT INTO salon_service_categories (salon_id, category_id, is_active) VALUES
  ('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', true),
  ('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000003', true),
  ('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000004', true);

INSERT INTO services
  (id, salon_id, category_id, form_template_id, name, description, duration_minutes, price_minor, sort_order)
VALUES
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002', 'Full Set - Acrylic', 'Acrylic full set with shape and finish selection.', 90, 8500, 10),
  ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002', 'Full Set - Gel', 'Gel full set with custom nail details.', 75, 8500, 20),
  ('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002', 'Nail Fill', 'Maintenance fill for acrylic or gel nails.', 60, 6500, 30),
  ('60000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000003', 'Cat Eye - Classic', 'Classic cat-eye lash set.', 90, 12000, 10),
  ('60000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000003', 'Lash Fill', 'Maintenance lash fill.', 60, 7500, 20),
  ('60000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000004', 'Cosmetology - Dermapen', 'Microneedling facial treatment with professional equipment.', 60, 9500, 10),
  ('60000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000004', 'Chemical Peel', 'Professional facial chemical peel.', 60, 9000, 20),
  ('60000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000005', 'Micropigmentation - Microblading', 'Eyebrow microblading treatment.', 120, 10500, 10),
  ('60000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000005', 'Lip Liner', 'Semi-permanent lip liner treatment.', 120, 11000, 20);

INSERT INTO professionals
  (
    id, salon_id, user_id, full_name, email, phone, avatar_url, languages, bio,
    status, is_owner, salon_earnings_percent, professional_earnings_percent
  )
VALUES
  (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'Sarah Johnson',
    'sarah@glowsalon.example',
    '+1-305-555-0101',
    '/mock/avatars/sarah-johnson.jpg',
    ARRAY['English', 'Spanish'],
    'Salon owner and nail professional.',
    'active',
    true,
    40.00,
    60.00
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    'Maria Garcia',
    'maria@glowsalon.example',
    '+1-305-555-0102',
    '/mock/avatars/maria-garcia.jpg',
    ARRAY['English', 'Spanish'],
    'Lash and micropigmentation specialist.',
    'active',
    false,
    40.00,
    60.00
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000003',
    'Emily Chen',
    'emily@glowsalon.example',
    '+1-305-555-0103',
    '/mock/avatars/emily-chen.jpg',
    ARRAY['English'],
    'Cosmetology and skincare professional.',
    'active',
    false,
    40.00,
    60.00
  );

INSERT INTO professional_services (professional_id, salon_id, service_id) VALUES
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000004'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000005'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000008'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000009'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000006'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000007');

-- Clients and health profiles ------------------------------------------------

INSERT INTO clients
  (id, salon_id, full_name, email, phone, date_of_birth, preferred_language, notes)
VALUES
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Sarah Jenkins', 'sarah.jenkins@example.com', '+1-305-555-0201', '1992-04-16', 'en', 'Prefers shorter nail length.'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Maria Rodriguez', 'maria.rodriguez@example.com', '+1-305-555-0202', '1989-09-08', 'es', 'Sensitive eyes. Use hypoallergenic glue.'),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Emily Wilson', 'emily.wilson@example.com', '+1-305-555-0203', '1995-01-22', 'en', 'Focus on T-zone hydration.'),
  ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Sofia Hernandez', 'sofia.hernandez@example.com', '+1-305-555-0204', '1990-07-11', 'es', 'Returning client.'),
  ('40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'Laura Perez', 'laura.perez@example.com', '+1-305-555-0205', '1998-12-03', 'en', 'Returning client.'),
  ('40000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'Ana Martinez', 'ana.martinez@example.com', '+1-305-555-0206', '1993-06-27', 'es', 'First visit.'),
  ('40000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'Carmen Lopez', 'carmen.lopez@example.com', '+1-305-555-0207', '1987-03-14', 'es', 'Returning client.'),
  ('40000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 'Jessica Davis', 'jessica.davis@example.com', '+1-305-555-0208', '1996-10-05', 'en', 'Online booking client.');

INSERT INTO client_health_profiles
  (id, salon_id, client_id, allergies, medications, conditions, notes, responses_json, reviewed_at, reviewed_by_user_id)
VALUES
  ('41000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Latex, nickel', 'None', 'Sensitive skin', 'No contraindications reported.', '{"pregnant": false, "diabetes": false}'::jsonb, '2025-12-28 14:00:00+00', '20000000-0000-0000-0000-000000000001'),
  ('41000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'None known', 'None', 'Sensitive eyes', 'Use hypoallergenic adhesive.', '{"contact_lenses": true, "eye_infection": false}'::jsonb, '2025-12-28 16:00:00+00', '20000000-0000-0000-0000-000000000002'),
  ('41000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'None known', 'None', 'Dry skin', 'Hydration treatment recommended.', '{"pregnant": false, "retinoids": false}'::jsonb, '2025-12-29 17:00:00+00', '20000000-0000-0000-0000-000000000003'),
  ('41000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 'Latex, nickel', 'None', 'Sensitive skin', 'Profile shown in registration flow.', '{"first_visit": false}'::jsonb, '2026-03-16 13:00:00+00', '20000000-0000-0000-0000-000000000001'),
  ('41000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000005', 'None known', 'None', NULL, NULL, '{}'::jsonb, '2026-03-16 13:00:00+00', '20000000-0000-0000-0000-000000000001'),
  ('41000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000006', 'None known', 'None', NULL, NULL, '{}'::jsonb, '2026-03-16 13:00:00+00', '20000000-0000-0000-0000-000000000001'),
  ('41000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000007', 'None known', 'None', NULL, NULL, '{}'::jsonb, '2026-03-16 13:00:00+00', '20000000-0000-0000-0000-000000000001'),
  ('41000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000008', 'None known', 'None', NULL, NULL, '{}'::jsonb, '2026-03-16 13:00:00+00', '20000000-0000-0000-0000-000000000001');

-- Weekly working hours and calendar availability ----------------------------
-- PostgreSQL day_of_week: Sunday=0 through Saturday=6.

INSERT INTO salon_working_hours
  (id, salon_id, day_of_week, is_open, opens_at, closes_at)
VALUES
  ('b0000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 0, false, NULL, NULL),
  ('b0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, true, '09:00', '18:00'),
  ('b0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 2, true, '09:00', '18:00'),
  ('b0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 3, true, '09:00', '18:00'),
  ('b0000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 4, true, '09:00', '18:00'),
  ('b0000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 5, true, '09:00', '18:00'),
  ('b0000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 6, true, '09:00', '14:00');

INSERT INTO professional_working_hours
  (id, salon_id, professional_id, day_of_week, is_working, starts_at, ends_at)
SELECT
  md5(professional_id::text || ':' || day_of_week::text)::uuid,
  '10000000-0000-0000-0000-000000000001'::uuid,
  professional_id,
  day_of_week,
  is_working,
  starts_at,
  ends_at
FROM (
  VALUES
    ('30000000-0000-0000-0000-000000000001'::uuid, 0::smallint, false, NULL::time, NULL::time),
    ('30000000-0000-0000-0000-000000000001'::uuid, 1::smallint, true, '09:00'::time, '18:00'::time),
    ('30000000-0000-0000-0000-000000000001'::uuid, 2::smallint, true, '09:00'::time, '18:00'::time),
    ('30000000-0000-0000-0000-000000000001'::uuid, 3::smallint, true, '09:00'::time, '18:00'::time),
    ('30000000-0000-0000-0000-000000000001'::uuid, 4::smallint, true, '09:00'::time, '18:00'::time),
    ('30000000-0000-0000-0000-000000000001'::uuid, 5::smallint, true, '09:00'::time, '18:00'::time),
    ('30000000-0000-0000-0000-000000000001'::uuid, 6::smallint, true, '09:00'::time, '14:00'::time),
    ('30000000-0000-0000-0000-000000000002'::uuid, 0::smallint, false, NULL::time, NULL::time),
    ('30000000-0000-0000-0000-000000000002'::uuid, 1::smallint, true, '10:00'::time, '18:00'::time),
    ('30000000-0000-0000-0000-000000000002'::uuid, 2::smallint, true, '10:00'::time, '18:00'::time),
    ('30000000-0000-0000-0000-000000000002'::uuid, 3::smallint, true, '10:00'::time, '18:00'::time),
    ('30000000-0000-0000-0000-000000000002'::uuid, 4::smallint, true, '10:00'::time, '18:00'::time),
    ('30000000-0000-0000-0000-000000000002'::uuid, 5::smallint, true, '10:00'::time, '18:00'::time),
    ('30000000-0000-0000-0000-000000000002'::uuid, 6::smallint, false, NULL::time, NULL::time),
    ('30000000-0000-0000-0000-000000000003'::uuid, 0::smallint, false, NULL::time, NULL::time),
    ('30000000-0000-0000-0000-000000000003'::uuid, 1::smallint, true, '09:00'::time, '17:00'::time),
    ('30000000-0000-0000-0000-000000000003'::uuid, 2::smallint, true, '09:00'::time, '17:00'::time),
    ('30000000-0000-0000-0000-000000000003'::uuid, 3::smallint, true, '09:00'::time, '17:00'::time),
    ('30000000-0000-0000-0000-000000000003'::uuid, 4::smallint, true, '09:00'::time, '17:00'::time),
    ('30000000-0000-0000-0000-000000000003'::uuid, 5::smallint, true, '09:00'::time, '17:00'::time),
    ('30000000-0000-0000-0000-000000000003'::uuid, 6::smallint, false, NULL::time, NULL::time)
) AS hours(professional_id, day_of_week, is_working, starts_at, ends_at);

INSERT INTO availability_exceptions
  (id, salon_id, professional_id, exception_type, starts_at, ends_at, reason, created_by_user_id)
VALUES
  ('b2000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'time_off', '2026-03-20 13:00:00-04', '2026-03-20 17:00:00-04', 'Personal appointment', '20000000-0000-0000-0000-000000000001'),
  ('b2000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', NULL, 'holiday', '2026-03-22 00:00:00-04', '2026-03-23 00:00:00-04', 'Salon closed', '20000000-0000-0000-0000-000000000001');

-- Appointments ---------------------------------------------------------------
-- Completed sales mirror the Sales History cards; upcoming records mirror the
-- Home and calendar examples around March 18, 2026.

INSERT INTO appointments
  (
    id, salon_id, client_id, professional_id, status_code, source, starts_at, ends_at,
    customer_notes, internal_notes, created_by_user_id, created_at
  )
VALUES
  ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'completed', 'internal', '2025-12-28 14:30:00-05', '2025-12-28 15:45:00-05', 'Client preferred shorter length on thumbs due to typing.', 'Careful with cuticles.', '20000000-0000-0000-0000-000000000001', '2025-12-20 15:00:00+00'),
  ('70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'completed', 'internal', '2025-12-15 14:30:00-05', '2025-12-15 16:00:00-05', 'Sensitive eyes.', 'Used hypoallergenic glue.', '20000000-0000-0000-0000-000000000001', '2025-12-05 15:00:00+00'),
  ('70000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'completed', 'internal', '2025-12-10 11:00:00-05', '2025-12-10 12:00:00-05', 'Focus on T-zone hydration.', 'Skin responded well.', '20000000-0000-0000-0000-000000000001', '2025-12-01 15:00:00+00'),
  ('70000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'completed', 'internal', '2025-12-02 09:00:00-05', '2025-12-02 11:00:00-05', 'Natural eyebrow finish.', 'First control scheduled.', '20000000-0000-0000-0000-000000000001', '2025-11-20 15:00:00+00'),
  ('70000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'coming_up', 'internal', '2026-03-18 09:00:00-04', '2026-03-18 10:30:00-04', 'Full set appointment.', 'Confirm nail shape before service.', '20000000-0000-0000-0000-000000000001', '2026-03-10 15:00:00+00'),
  ('70000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000002', 'scheduled', 'public_booking', '2026-03-18 11:30:00-04', '2026-03-18 13:00:00-04', 'Classic cat-eye set.', NULL, '20000000-0000-0000-0000-000000000001', '2026-03-11 15:00:00+00'),
  ('70000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000003', 'scheduled', 'internal', '2026-03-18 13:00:00-04', '2026-03-18 14:00:00-04', 'Dermapen consultation complete.', NULL, '20000000-0000-0000-0000-000000000001', '2026-03-12 15:00:00+00'),
  ('70000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000002', 'scheduled', 'public_booking', '2026-03-19 10:00:00-04', '2026-03-19 11:00:00-04', 'Lash fill booked from salon link.', NULL, '20000000-0000-0000-0000-000000000001', '2026-03-13 15:00:00+00');

INSERT INTO appointment_services
  (
    id, salon_id, appointment_id, service_id, service_name_snapshot,
    category_code_snapshot, duration_minutes_snapshot, unit_price_minor, status_code
  )
VALUES
  ('71000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', 'Full Set - Gel', 'nails', 75, 8500, 'completed'),
  ('71000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000004', 'Cat Eye - Classic', 'lashes', 90, 12000, 'completed'),
  ('71000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000006', 'Cosmetology - Dermapen', 'cosmetology', 60, 9500, 'completed'),
  ('71000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000008', 'Micropigmentation - Microblading', 'micropigmentation', 120, 10500, 'completed'),
  ('71000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000001', 'Full Set - Acrylic', 'nails', 90, 8500, 'coming_up'),
  ('71000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000004', 'Cat Eye - Classic', 'lashes', 90, 12000, 'scheduled'),
  ('71000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000007', '60000000-0000-0000-0000-000000000006', 'Cosmetology - Dermapen', 'cosmetology', 60, 9500, 'scheduled'),
  ('71000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000008', '60000000-0000-0000-0000-000000000005', 'Lash Fill', 'lashes', 60, 7500, 'scheduled');

INSERT INTO appointment_status_history
  (id, salon_id, appointment_id, status_code, changed_by_user_id, changed_at, note)
VALUES
  ('72000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'completed', '20000000-0000-0000-0000-000000000001', '2025-12-28 15:45:00-05', 'Service marked complete.'),
  ('72000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', 'completed', '20000000-0000-0000-0000-000000000002', '2025-12-15 16:00:00-05', 'Service marked complete.'),
  ('72000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000003', 'completed', '20000000-0000-0000-0000-000000000003', '2025-12-10 12:00:00-05', 'Service marked complete.'),
  ('72000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000004', 'completed', '20000000-0000-0000-0000-000000000002', '2025-12-02 11:00:00-05', 'Service marked complete.'),
  ('72000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000005', 'coming_up', '20000000-0000-0000-0000-000000000001', '2026-03-18 08:45:00-04', 'Client is arriving soon.'),
  ('72000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000006', 'scheduled', '20000000-0000-0000-0000-000000000001', '2026-03-11 15:00:00+00', 'Booked from salon link.'),
  ('72000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000007', 'scheduled', '20000000-0000-0000-0000-000000000001', '2026-03-12 15:00:00+00', 'Created by salon.'),
  ('72000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000008', 'scheduled', '20000000-0000-0000-0000-000000000001', '2026-03-13 15:00:00+00', 'Booked from salon link.');

INSERT INTO appointment_events
  (id, salon_id, appointment_id, event_type, actor_user_id, from_status_code, to_status_code, metadata_json, created_at)
VALUES
  ('73000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'service_completed', '20000000-0000-0000-0000-000000000001', 'in_progress', 'completed', '{"source": "mockup"}'::jsonb, '2025-12-28 15:45:00-05'),
  ('73000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', 'service_completed', '20000000-0000-0000-0000-000000000002', 'in_progress', 'completed', '{"source": "mockup"}'::jsonb, '2025-12-15 16:00:00-05'),
  ('73000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000003', 'service_completed', '20000000-0000-0000-0000-000000000003', 'in_progress', 'completed', '{"source": "mockup"}'::jsonb, '2025-12-10 12:00:00-05'),
  ('73000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000004', 'service_completed', '20000000-0000-0000-0000-000000000002', 'in_progress', 'completed', '{"source": "mockup"}'::jsonb, '2025-12-02 11:00:00-05'),
  ('73000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000005', 'status_changed', '20000000-0000-0000-0000-000000000001', 'scheduled', 'coming_up', '{"source": "calendar"}'::jsonb, '2026-03-18 08:45:00-04');

-- Submitted intake, consent, treatment details, and media --------------------

INSERT INTO client_form_submissions
  (id, salon_id, client_id, form_template_id, appointment_id, submitted_by_user_id, status, answers_json, submitted_at)
VALUES
  ('92000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'submitted', '{"procedure_explained": true, "risks_acknowledged": true, "aftercare_acknowledged": true}'::jsonb, '2025-12-28 14:25:00-05'),
  ('92000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'submitted', '{"procedure_explained": true, "risks_acknowledged": true, "aftercare_acknowledged": true}'::jsonb, '2025-12-15 14:25:00-05'),
  ('92000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'submitted', '{"procedure_explained": true, "risks_acknowledged": true, "aftercare_acknowledged": true}'::jsonb, '2025-12-10 10:55:00-05'),
  ('92000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'submitted', '{"procedure_explained": true, "risks_acknowledged": true, "aftercare_acknowledged": true, "data_processing_accepted": true}'::jsonb, '2025-12-02 08:55:00-05');

INSERT INTO consent_records
  (id, salon_id, client_id, appointment_id, form_submission_id, client_signature_storage_key, professional_signature_storage_key, signed_at, professional_signed_at)
VALUES
  ('93000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', 'consent/glow-salon/sarah-jenkins-client.png', 'consent/glow-salon/sarah-johnson-professional.png', '2025-12-28 14:25:00-05', '2025-12-28 14:26:00-05'),
  ('93000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000002', 'consent/glow-salon/maria-rodriguez-lashes.png', 'consent/glow-salon/maria-garcia-lashes.png', '2025-12-15 14:25:00-05', '2025-12-15 14:26:00-05'),
  ('93000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000003', '92000000-0000-0000-0000-000000000003', 'consent/glow-salon/emily-wilson-client.png', 'consent/glow-salon/emily-chen-professional.png', '2025-12-10 10:55:00-05', '2025-12-10 10:56:00-05'),
  ('93000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000004', '92000000-0000-0000-0000-000000000004', 'consent/glow-salon/maria-rodriguez-microblading.png', 'consent/glow-salon/maria-garcia-microblading.png', '2025-12-02 08:55:00-05', '2025-12-02 08:56:00-05');

INSERT INTO treatment_records
  (
    id, salon_id, appointment_service_id, client_id, professional_id, category_code,
    form_template_id, form_template_version, details_json, notes, recommendations, completed_at
  )
VALUES
  (
    '91000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'nails',
    '90000000-0000-0000-0000-000000000002',
    1,
    '{"system": "gel", "shape": "coffin", "materials": ["poly gel", "gel polish"], "hand": "right", "finger_details": {"thumb": {"length_mm": 6, "shape": "coffin"}}}'::jsonb,
    'Client preferred shorter length on thumbs due to typing. Careful with cuticles.',
    'Apply cuticle oil daily.',
    '2025-12-28 15:45:00-05'
  ),
  (
    '91000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002',
    'lashes',
    '90000000-0000-0000-0000-000000000003',
    1,
    '{"style": "cat eye", "eye_shape": "almond eyes", "volume": "classic", "curl": "C", "thickness": "0.06", "length_mm": 8, "adhesive": "hypoallergenic"}'::jsonb,
    'Sensitive eyes. Used hypoallergenic glue.',
    'Avoid water and steam for 24 hours.',
    '2025-12-15 16:00:00-05'
  ),
  (
    '91000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000003',
    '40000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000003',
    'cosmetology',
    '90000000-0000-0000-0000-000000000004',
    1,
    '{"skin_type": "dry", "alterations": ["dehydration"], "facial_annotations": [{"zone": "forehead", "type": "dryness"}], "equipment": {"name": "Dermapen", "speed": 5}, "products": ["hyaluronic acid serum"]}'::jsonb,
    'Focus on T-zone hydration.',
    'Use SPF 50 and avoid exfoliation for seven days.',
    '2025-12-10 12:00:00-05'
  ),
  (
    '91000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000004',
    '40000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002',
    'micropigmentation',
    '90000000-0000-0000-0000-000000000005',
    1,
    '{"area": "eyebrows", "service_type": "microblading", "skin_tone": "type 3", "pigment": "Perma Blend Tina Davies", "needle": "nano blade", "control_date": "2026-01-02"}'::jsonb,
    'Natural finish requested.',
    'Keep area dry and apply recommended balm.',
    '2025-12-02 11:00:00-05'
  );

INSERT INTO treatment_media
  (id, treatment_record_id, media_type, storage_key, mime_type, metadata_json)
VALUES
  ('94000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'diagram', 'treatments/glow-salon/nails/right-hand.png', 'image/png', '{"hand": "right"}'::jsonb),
  ('94000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000002', 'reference', 'treatments/glow-salon/lashes/maria-reference.jpg', 'image/jpeg', '{"source": "camera"}'::jsonb),
  ('94000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000003', 'diagram', 'treatments/glow-salon/cosmetology/emily-face-map.png', 'image/png', '{"annotations": 1}'::jsonb),
  ('94000000-0000-0000-0000-000000000004', '91000000-0000-0000-0000-000000000004', 'before', 'treatments/glow-salon/microblading/maria-before.jpg', 'image/jpeg', '{}'::jsonb);

-- Completed appointment finance, payments, invoices, receipts, and sales ----

INSERT INTO appointment_financials
  (
    id, salon_id, appointment_id, subtotal_minor, discount_minor, tax_minor, tip_minor,
    total_minor, salon_earnings_minor, professional_earnings_minor, currency_code, recorded_at
  )
VALUES
  ('80000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 8500, 0, 0, 1000, 9500, 3400, 6100, 'USD', '2025-12-28 15:45:00-05'),
  ('80000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', 12000, 0, 0, 1000, 13000, 4800, 8200, 'USD', '2025-12-15 16:00:00-05'),
  ('80000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000003', 9500, 0, 0, 1000, 10500, 3800, 6700, 'USD', '2025-12-10 12:00:00-05'),
  ('80000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000004', 10500, 0, 0, 1000, 11500, 4200, 7300, 'USD', '2025-12-02 11:00:00-05');

INSERT INTO payments
  (
    id, salon_id, appointment_id, client_id, payment_provider, provider_payment_id,
    method, status, amount_minor, tip_minor, currency_code, paid_at, metadata_json
  )
VALUES
  ('81000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'mock_terminal', 'pay_full_set_gel', 'card', 'paid', 9500, 1000, 'USD', '2025-12-28 15:46:00-05', '{"last4": "4242"}'::jsonb),
  ('81000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'mock_terminal', 'pay_cat_eye', 'card', 'paid', 13000, 1000, 'USD', '2025-12-15 16:01:00-05', '{"last4": "1111"}'::jsonb),
  ('81000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', NULL, NULL, 'cash', 'paid', 10500, 1000, 'USD', '2025-12-10 12:01:00-05', '{}'::jsonb),
  ('81000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002', 'mock_terminal', 'pay_microblading', 'digital_wallet', 'paid', 11500, 1000, 'USD', '2025-12-02 11:01:00-05', '{"wallet": "apple_pay"}'::jsonb);

INSERT INTO invoices
  (
    id, salon_id, appointment_id, client_id, invoice_number, status, subtotal_minor,
    discount_minor, tax_minor, tip_minor, total_minor, currency_code, issued_at, paid_at
  )
VALUES
  ('82000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'INV-2025-1201', 'paid', 8500, 0, 0, 1000, 9500, 'USD', '2025-12-28 15:45:00-05', '2025-12-28 15:46:00-05'),
  ('82000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'INV-2025-1202', 'paid', 12000, 0, 0, 1000, 13000, 'USD', '2025-12-15 16:00:00-05', '2025-12-15 16:01:00-05'),
  ('82000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', 'INV-2025-1203', 'paid', 9500, 0, 0, 1000, 10500, 'USD', '2025-12-10 12:00:00-05', '2025-12-10 12:01:00-05'),
  ('82000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002', 'INV-2025-1204', 'paid', 10500, 0, 0, 1000, 11500, 'USD', '2025-12-02 11:00:00-05', '2025-12-02 11:01:00-05');

INSERT INTO invoice_items
  (id, salon_id, invoice_id, appointment_service_id, description, quantity, unit_price_minor, line_total_minor)
VALUES
  ('83000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Full Set - Gel', 1, 8500, 8500),
  ('83000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000002', 'Cat Eye - Classic', 1, 12000, 12000),
  ('83000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000003', 'Cosmetology - Dermapen', 1, 9500, 9500),
  ('83000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000004', '71000000-0000-0000-0000-000000000004', 'Micropigmentation - Microblading', 1, 10500, 10500);

INSERT INTO payment_allocations
  (id, salon_id, payment_id, invoice_id, amount_minor)
VALUES
  ('84000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', 9500),
  ('84000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000002', 13000),
  ('84000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000003', '82000000-0000-0000-0000-000000000003', 10500),
  ('84000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000004', '82000000-0000-0000-0000-000000000004', 11500);

INSERT INTO receipts
  (id, salon_id, invoice_id, payment_id, receipt_number, issued_at, delivery_email, storage_key)
VALUES
  ('85000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'RCP-2025-1201', '2025-12-28 15:46:00-05', 'sarah.jenkins@example.com', 'receipts/glow-salon/RCP-2025-1201.pdf'),
  ('85000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000002', 'RCP-2025-1202', '2025-12-15 16:01:00-05', 'maria.rodriguez@example.com', 'receipts/glow-salon/RCP-2025-1202.pdf'),
  ('85000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000003', 'RCP-2025-1203', '2025-12-10 12:01:00-05', 'emily.wilson@example.com', 'receipts/glow-salon/RCP-2025-1203.pdf'),
  ('85000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000004', '81000000-0000-0000-0000-000000000004', 'RCP-2025-1204', '2025-12-02 11:01:00-05', 'maria.rodriguez@example.com', 'receipts/glow-salon/RCP-2025-1204.pdf');

-- Notifications and future client-app review samples ------------------------

INSERT INTO notification_preferences
  (id, salon_id, user_id, channel, event_type, is_enabled)
VALUES
  ('c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'in_app', 'appointment_created', true),
  ('c0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'email', 'appointment_reminder', true),
  ('c0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'push', 'appointment_reminder', true);

INSERT INTO notifications
  (
    id, salon_id, user_id, client_id, appointment_id, channel, event_type, recipient,
    title, body, status, scheduled_for, sent_at, read_at, provider_message_id, metadata_json
  )
VALUES
  ('c1000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000006', 'in_app', 'appointment_created', NULL, 'New appointment booked', 'Laura Perez booked Cat Eye - Classic for March 18 at 11:30 AM.', 'read', NULL, '2026-03-11 15:00:00+00', '2026-03-11 15:10:00+00', NULL, '{"source": "public_booking"}'::jsonb),
  ('c1000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', NULL, '40000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000005', 'sms', 'appointment_reminder', '+1-305-555-0204', 'Appointment reminder', 'Your Full Set - Acrylic appointment at Glow Salon is today at 9:00 AM.', 'delivered', '2026-03-18 07:00:00-04', '2026-03-18 07:00:05-04', NULL, 'mock_sms_001', '{}'::jsonb),
  ('c1000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', NULL, '40000000-0000-0000-0000-000000000008', '70000000-0000-0000-0000-000000000008', 'email', 'appointment_confirmation', 'jessica.davis@example.com', 'Booking confirmed', 'Your Lash Fill at Glow Salon is confirmed for March 19 at 10:00 AM.', 'sent', NULL, '2026-03-13 15:01:00+00', NULL, 'mock_email_001', '{"source": "salon_link"}'::jsonb);

-- Reviews are not shown in the current salon mockups. These two records exist
-- only to support the explicitly requested future client-facing application.
INSERT INTO reviews
  (id, salon_id, appointment_id, client_id, professional_id, rating, comment, is_public, published_at)
VALUES
  ('c2000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 5, 'Beautiful shape and careful service.', true, '2025-12-29 15:00:00+00'),
  ('c2000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 5, 'My skin felt hydrated and refreshed.', true, '2025-12-11 15:00:00+00');

-- Fail fast if the mockup scenario is incomplete.
DO $$
BEGIN
  IF (SELECT count(*) FROM salons WHERE slug = 'glow-salon') <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one Glow Salon seed record';
  END IF;

  IF (SELECT count(*) FROM professionals WHERE salon_id = '10000000-0000-0000-0000-000000000001') <> 3 THEN
    RAISE EXCEPTION 'Expected three Glow Salon professionals';
  END IF;

  IF (SELECT count(*) FROM services WHERE salon_id = '10000000-0000-0000-0000-000000000001') <> 9 THEN
    RAISE EXCEPTION 'Expected nine Glow Salon services';
  END IF;

  IF (SELECT count(*) FROM appointments WHERE salon_id = '10000000-0000-0000-0000-000000000001') <> 8 THEN
    RAISE EXCEPTION 'Expected eight Glow Salon appointments';
  END IF;

  IF (SELECT count(*) FROM sales_history WHERE salon_id = '10000000-0000-0000-0000-000000000001') <> 4 THEN
    RAISE EXCEPTION 'Expected four completed sales-history records';
  END IF;

  IF (SELECT count(*) FROM public_booking_catalog WHERE salon_slug = 'glow-salon') <> 9 THEN
    RAISE EXCEPTION 'Expected nine publicly bookable catalog services';
  END IF;
END;
$$;

COMMIT;
