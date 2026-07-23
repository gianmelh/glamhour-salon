BEGIN;

CREATE TABLE service_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
  service_id uuid,
  name varchar(160) NOT NULL,
  brand varchar(160),
  material_type varchar(100),
  unit varchar(40),
  cost_minor integer,
  currency_code char(3) NOT NULL DEFAULT 'USD',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, id),
  FOREIGN KEY (salon_id, service_id) REFERENCES services(salon_id, id) ON DELETE SET NULL,
  CONSTRAINT service_materials_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT service_materials_cost_check CHECK (cost_minor IS NULL OR cost_minor >= 0),
  CONSTRAINT service_materials_currency_check CHECK (currency_code ~ '^[A-Z]{3}$')
);

CREATE INDEX service_materials_salon_category_idx
  ON service_materials (salon_id, category_id, is_active);

CREATE INDEX service_materials_service_idx
  ON service_materials (salon_id, service_id)
  WHERE service_id IS NOT NULL;

CREATE TRIGGER service_materials_set_updated_at
  BEFORE UPDATE ON service_materials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
