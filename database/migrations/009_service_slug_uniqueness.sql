BEGIN;

-- Stable service identity for idempotent booking upserts (micropigmentation and future categories).
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS slug varchar(160);

-- Backfill unique slugs. Append a short id suffix when normalized names collide.
WITH ranked AS (
  SELECT
    id,
    lower(regexp_replace(regexp_replace(btrim(name), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')) AS base_slug,
    row_number() OVER (
      PARTITION BY salon_id,
        lower(regexp_replace(regexp_replace(btrim(name), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'))
      ORDER BY created_at, id
    ) AS rn
  FROM services
  WHERE slug IS NULL OR btrim(slug) = ''
)
UPDATE services AS s
SET slug = CASE
  WHEN r.base_slug = '' THEN 'service-' || substr(replace(s.id::text, '-', ''), 1, 8)
  WHEN r.rn = 1 THEN r.base_slug
  ELSE left(r.base_slug, 140) || '-' || substr(replace(s.id::text, '-', ''), 1, 8)
END
FROM ranked AS r
WHERE s.id = r.id;

ALTER TABLE services
  ALTER COLUMN slug SET NOT NULL;

ALTER TABLE services
  DROP CONSTRAINT IF EXISTS services_slug_format;

ALTER TABLE services
  ADD CONSTRAINT services_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

ALTER TABLE services
  DROP CONSTRAINT IF EXISTS services_salon_slug_unique;

ALTER TABLE services
  ADD CONSTRAINT services_salon_slug_unique UNIQUE (salon_id, slug);

COMMIT;
