-- =====================================================================
-- Tenant schema: one copy of everything below lives in each organisation's
-- own PostgreSQL schema (tenant_<code>). The migration runner sets
-- search_path to that schema first, so nothing here is schema-qualified.
-- Conventions
--   * snake_case, plural table names, singular column names
--   * bigint identity primary keys, uuid only where a key is shared publicly
--   * money in numeric(14,2), quantities in numeric(12,2)
--   * every business table has created_at / updated_at
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------
CREATE TYPE user_role AS ENUM (
  'OWNER', 'PRODUCTION_MANAGER', 'STORE_MANAGER', 'QUALITY_INSPECTOR', 'ACCOUNTANT', 'BUYER'
);
CREATE TYPE order_status AS ENUM (
  'NEW', 'IN_PRODUCTION', 'QUALITY_CHECK', 'READY_TO_DISPATCH',
  'PARTIALLY_DISPATCHED', 'DISPATCHED', 'CANCELLED'
);
CREATE TYPE order_priority AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE production_stage AS ENUM ('SPINNING', 'WEAVING', 'DYEING');
CREATE TYPE machine_status AS ENUM ('RUNNING', 'IDLE', 'BREAKDOWN', 'MAINTENANCE');
CREATE TYPE job_status AS ENUM ('PLANNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED');
CREATE TYPE stock_movement_type AS ENUM ('RECEIPT', 'ISSUE', 'ADJUSTMENT', 'RETURN');
CREATE TYPE roll_status AS ENUM ('PENDING_QC', 'PASSED', 'REWORK', 'REJECTED', 'DISPATCHED');
CREATE TYPE inspection_result AS ENUM ('PASS', 'REWORK', 'REJECT');
CREATE TYPE defect_type AS ENUM (
  'HOLE', 'COLOUR_MISMATCH', 'UNEVEN_WEAVING', 'STAIN', 'BROKEN_YARN', 'WIDTH_VARIATION', 'OTHER'
);
CREATE TYPE invoice_status AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');
CREATE TYPE payment_method AS ENUM ('BANK_TRANSFER', 'UPI', 'CHEQUE', 'CASH');
CREATE TYPE attendance_status AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE');
CREATE TYPE payroll_status AS ENUM ('DRAFT', 'PAID');

-- Keeps updated_at honest without relying on application code.
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- Parties
-- ---------------------------------------------------------------------
CREATE TABLE buyers (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_name    text NOT NULL,
  contact_person  text,
  phone           text,
  email           text,
  gst_number      text,
  address         text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX buyers_company_name_trgm ON buyers USING gin (company_name gin_trgm_ops);

CREATE TABLE suppliers (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_name    text NOT NULL,
  contact_person  text,
  phone           text,
  email           text,
  gst_number      text,
  address         text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX suppliers_company_name_trgm ON suppliers USING gin (company_name gin_trgm_ops);

CREATE TABLE users (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name       text NOT NULL,
  email           text NOT NULL,
  -- NULL until an invited person sets their own password (see password_reset_codes).
  password_hash   text,
  role            user_role NOT NULL,
  buyer_id        bigint REFERENCES buyers(id),
  is_active       boolean NOT NULL DEFAULT true,
  activated_at    timestamptz,
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_buyer_link CHECK ((role = 'BUYER') = (buyer_id IS NOT NULL)),
  CONSTRAINT users_activated_have_password CHECK (activated_at IS NULL OR password_hash IS NOT NULL)
);
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

-- One-time codes for "forgot password" and first-time account setup.
-- Only a hash of the code is stored; codes expire and lock after repeated wrong guesses.
CREATE TABLE password_reset_codes (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash        text NOT NULL,
  expires_at       timestamptz NOT NULL,
  failed_attempts  integer NOT NULL DEFAULT 0,
  verified_at      timestamptz,
  consumed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_codes_user_idx ON password_reset_codes (user_id, created_at DESC);

-- ---------------------------------------------------------------------
-- Raw material: yarn
-- ---------------------------------------------------------------------
CREATE TABLE yarn_types (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code               text NOT NULL UNIQUE,
  name               text NOT NULL,
  material           text NOT NULL,          -- cotton, polyester, viscose ...
  yarn_count         text NOT NULL,          -- e.g. 40s, 2/60s
  colour             text NOT NULL,
  current_stock_kg   numeric(12,2) NOT NULL DEFAULT 0 CHECK (current_stock_kg >= 0),
  reorder_level_kg   numeric(12,2) NOT NULL DEFAULT 0 CHECK (reorder_level_kg >= 0),
  average_cost_per_kg numeric(12,2) NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX yarn_types_search_trgm ON yarn_types
  USING gin ((code || ' ' || name || ' ' || colour) gin_trgm_ops);

CREATE TABLE fabric_types (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name                 text NOT NULL UNIQUE,
  construction         text,                -- e.g. 60x60 / 92x88
  gsm                  integer CHECK (gsm > 0),
  width_inches         numeric(6,2),
  yarn_type_id         bigint NOT NULL REFERENCES yarn_types(id),
  yarn_kg_per_meter    numeric(8,4) NOT NULL CHECK (yarn_kg_per_meter > 0),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------
CREATE TABLE orders (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_number      text NOT NULL UNIQUE,
  buyer_id          bigint NOT NULL REFERENCES buyers(id),
  fabric_type_id    bigint NOT NULL REFERENCES fabric_types(id),
  colour            text NOT NULL,
  quantity_meters   numeric(12,2) NOT NULL CHECK (quantity_meters > 0),
  rate_per_meter    numeric(12,2) NOT NULL CHECK (rate_per_meter >= 0),
  due_date          date NOT NULL,
  priority          order_priority NOT NULL DEFAULT 'NORMAL',
  status            order_status NOT NULL DEFAULT 'NEW',
  tracking_token    uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  notes             text,
  created_by        bigint REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_buyer_idx ON orders (buyer_id);
CREATE INDEX orders_status_due_idx ON orders (status, due_date);
CREATE INDEX orders_number_trgm ON orders USING gin (order_number gin_trgm_ops);

CREATE TABLE order_status_history (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id     bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status  order_status,
  to_status    order_status NOT NULL,
  note         text,
  changed_by   bigint REFERENCES users(id),
  changed_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_status_history_order_idx ON order_status_history (order_id, changed_at);

-- ---------------------------------------------------------------------
-- Yarn inward (GRN) and stock ledger
-- ---------------------------------------------------------------------
CREATE TABLE yarn_receipts (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  receipt_number    text NOT NULL UNIQUE,
  supplier_id       bigint NOT NULL REFERENCES suppliers(id),
  order_id          bigint REFERENCES orders(id),     -- yarn bought for a specific order (optional)
  vehicle_number    text,
  challan_number    text,
  bill_number       text,
  total_amount      numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid       numeric(14,2) NOT NULL DEFAULT 0,
  received_by       bigint REFERENCES users(id),
  received_at       timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT yarn_receipts_paid_le_total CHECK (amount_paid <= total_amount)
);
CREATE INDEX yarn_receipts_supplier_idx ON yarn_receipts (supplier_id);
CREATE INDEX yarn_receipts_received_at_idx ON yarn_receipts (received_at);

CREATE TABLE yarn_receipt_items (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  yarn_receipt_id  bigint NOT NULL REFERENCES yarn_receipts(id) ON DELETE CASCADE,
  yarn_type_id     bigint NOT NULL REFERENCES yarn_types(id),
  quantity_kg      numeric(12,2) NOT NULL CHECK (quantity_kg > 0),
  cost_per_kg      numeric(12,2) NOT NULL CHECK (cost_per_kg >= 0),
  line_amount      numeric(14,2) GENERATED ALWAYS AS (round(quantity_kg * cost_per_kg, 2)) STORED
);
CREATE INDEX yarn_receipt_items_receipt_idx ON yarn_receipt_items (yarn_receipt_id);

-- Every change to yarn stock is written here; yarn_types.current_stock_kg is the running balance.
CREATE TABLE yarn_stock_movements (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  yarn_type_id    bigint NOT NULL REFERENCES yarn_types(id),
  movement_type   stock_movement_type NOT NULL,
  quantity_kg     numeric(12,2) NOT NULL CHECK (quantity_kg <> 0),  -- signed: + in, - out
  cost_per_kg     numeric(12,2) NOT NULL DEFAULT 0,
  order_id        bigint REFERENCES orders(id),
  yarn_receipt_id bigint REFERENCES yarn_receipts(id),
  note            text,
  created_by      bigint REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX yarn_stock_movements_yarn_idx ON yarn_stock_movements (yarn_type_id, created_at DESC);
CREATE INDEX yarn_stock_movements_order_idx ON yarn_stock_movements (order_id) WHERE order_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- Production floor
-- ---------------------------------------------------------------------
CREATE TABLE shifts (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  starts_at   time NOT NULL,
  ends_at     time NOT NULL
);

CREATE TABLE machines (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code             text NOT NULL UNIQUE,
  name             text NOT NULL,
  stage            production_stage NOT NULL,
  status           machine_status NOT NULL DEFAULT 'IDLE',
  hourly_running_cost numeric(10,2) NOT NULL DEFAULT 0,
  location         text,
  status_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE machine_downtimes (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  machine_id   bigint NOT NULL REFERENCES machines(id),
  reason       text NOT NULL,
  started_at   timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz,
  reported_by  bigint REFERENCES users(id),
  CONSTRAINT machine_downtimes_period CHECK (ended_at IS NULL OR ended_at >= started_at)
);
-- Only one open breakdown per machine at a time.
CREATE UNIQUE INDEX machine_downtimes_one_open ON machine_downtimes (machine_id) WHERE ended_at IS NULL;

CREATE TABLE workers (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_code   text NOT NULL UNIQUE,
  full_name       text NOT NULL,
  phone           text,
  department      production_stage,          -- null = general / store / packing
  designation     text NOT NULL DEFAULT 'Operator',
  daily_wage      numeric(10,2) NOT NULL CHECK (daily_wage >= 0),
  joined_on       date NOT NULL DEFAULT CURRENT_DATE,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workers_name_trgm ON workers USING gin ((employee_code || ' ' || full_name) gin_trgm_ops);

CREATE TABLE production_jobs (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_number         text NOT NULL UNIQUE,
  order_id           bigint NOT NULL REFERENCES orders(id),
  stage              production_stage NOT NULL,
  machine_id         bigint NOT NULL REFERENCES machines(id),
  planned_quantity   numeric(12,2) NOT NULL CHECK (planned_quantity > 0),
  produced_quantity  numeric(12,2) NOT NULL DEFAULT 0 CHECK (produced_quantity >= 0),
  quantity_unit      text NOT NULL DEFAULT 'm',   -- 'kg' for spinning, 'm' for weaving / dyeing
  status             job_status NOT NULL DEFAULT 'PLANNED',
  started_at         timestamptz,
  completed_at       timestamptz,
  created_by         bigint REFERENCES users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX production_jobs_order_idx ON production_jobs (order_id);
CREATE INDEX production_jobs_machine_status_idx ON production_jobs (machine_id, status);
-- A machine can run only one job at a time.
CREATE UNIQUE INDEX production_jobs_one_active_per_machine
  ON production_jobs (machine_id) WHERE status = 'IN_PROGRESS';

-- Output entries made during a shift. Labour and machine cost are frozen at entry time
-- so later wage or rate changes never rewrite history.
CREATE TABLE production_logs (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  production_job_id  bigint NOT NULL REFERENCES production_jobs(id),
  machine_id         bigint NOT NULL REFERENCES machines(id),
  worker_id          bigint REFERENCES workers(id),
  shift_id           bigint REFERENCES shifts(id),
  quantity_produced  numeric(12,2) NOT NULL CHECK (quantity_produced > 0),
  hours_worked       numeric(5,2) NOT NULL CHECK (hours_worked > 0 AND hours_worked <= 24),
  labour_cost        numeric(12,2) NOT NULL DEFAULT 0,
  machine_cost       numeric(12,2) NOT NULL DEFAULT 0,
  logged_by          bigint REFERENCES users(id),
  logged_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX production_logs_machine_day_idx ON production_logs (machine_id, logged_at);
CREATE INDEX production_logs_job_idx ON production_logs (production_job_id);

-- ---------------------------------------------------------------------
-- Finished fabric and quality
-- ---------------------------------------------------------------------
CREATE TABLE fabric_rolls (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  roll_number        text NOT NULL UNIQUE,
  order_id           bigint NOT NULL REFERENCES orders(id),
  machine_id         bigint NOT NULL REFERENCES machines(id),
  production_job_id  bigint REFERENCES production_jobs(id),
  length_meters      numeric(10,2) NOT NULL CHECK (length_meters > 0),
  weight_kg          numeric(10,2) CHECK (weight_kg > 0),
  status             roll_status NOT NULL DEFAULT 'PENDING_QC',
  rack_location      text,
  created_by         bigint REFERENCES users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fabric_rolls_order_status_idx ON fabric_rolls (order_id, status);
CREATE INDEX fabric_rolls_status_idx ON fabric_rolls (status);
CREATE INDEX fabric_rolls_number_trgm ON fabric_rolls USING gin (roll_number gin_trgm_ops);

CREATE TABLE quality_inspections (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fabric_roll_id bigint NOT NULL REFERENCES fabric_rolls(id),
  inspector_id  bigint REFERENCES users(id),
  result        inspection_result NOT NULL,
  grade         char(1) CHECK (grade IN ('A', 'B', 'C')),
  defect_points integer NOT NULL DEFAULT 0 CHECK (defect_points >= 0),
  remarks       text,
  inspected_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quality_inspections_roll_idx ON quality_inspections (fabric_roll_id);
CREATE INDEX quality_inspections_date_idx ON quality_inspections (inspected_at);

CREATE TABLE inspection_defects (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quality_inspection_id  bigint NOT NULL REFERENCES quality_inspections(id) ON DELETE CASCADE,
  defect_type            defect_type NOT NULL,
  occurrences            integer NOT NULL DEFAULT 1 CHECK (occurrences > 0),
  note                   text
);
CREATE INDEX inspection_defects_inspection_idx ON inspection_defects (quality_inspection_id);

-- ---------------------------------------------------------------------
-- Dispatch, invoices, payments
-- ---------------------------------------------------------------------
CREATE TABLE invoices (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_number   text NOT NULL UNIQUE,
  order_id         bigint NOT NULL REFERENCES orders(id),
  buyer_id         bigint NOT NULL REFERENCES buyers(id),
  invoice_date     date NOT NULL DEFAULT CURRENT_DATE,
  due_date         date NOT NULL,
  total_meters     numeric(12,2) NOT NULL,
  rate_per_meter   numeric(12,2) NOT NULL,
  subtotal         numeric(14,2) NOT NULL,
  tax_percent      numeric(5,2) NOT NULL DEFAULT 5,
  tax_amount       numeric(14,2) NOT NULL,
  total_amount     numeric(14,2) NOT NULL,
  amount_paid      numeric(14,2) NOT NULL DEFAULT 0,
  status           invoice_status NOT NULL DEFAULT 'UNPAID',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_paid_le_total CHECK (amount_paid <= total_amount)
);
CREATE INDEX invoices_buyer_idx ON invoices (buyer_id);
CREATE INDEX invoices_date_idx ON invoices (invoice_date);

CREATE TABLE dispatches (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dispatch_number  text NOT NULL UNIQUE,
  order_id         bigint NOT NULL REFERENCES orders(id),
  buyer_id         bigint NOT NULL REFERENCES buyers(id),
  invoice_id       bigint NOT NULL UNIQUE REFERENCES invoices(id),
  vehicle_number   text NOT NULL,
  driver_name      text,
  driver_phone     text,
  total_rolls      integer NOT NULL,
  total_meters     numeric(12,2) NOT NULL,
  dispatched_by    bigint REFERENCES users(id),
  dispatched_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dispatches_order_idx ON dispatches (order_id);

-- UNIQUE(fabric_roll_id) is the guarantee that a roll can never be dispatched twice.
CREATE TABLE dispatch_items (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dispatch_id     bigint NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  fabric_roll_id  bigint NOT NULL UNIQUE REFERENCES fabric_rolls(id),
  length_meters   numeric(10,2) NOT NULL
);

CREATE TABLE buyer_payments (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_id     bigint NOT NULL REFERENCES invoices(id),
  buyer_id       bigint NOT NULL REFERENCES buyers(id),
  amount         numeric(14,2) NOT NULL CHECK (amount > 0),
  method         payment_method NOT NULL,
  reference      text,
  paid_on        date NOT NULL DEFAULT CURRENT_DATE,
  recorded_by    bigint REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX buyer_payments_paid_on_idx ON buyer_payments (paid_on);

CREATE TABLE supplier_payments (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  yarn_receipt_id  bigint NOT NULL REFERENCES yarn_receipts(id),
  supplier_id      bigint NOT NULL REFERENCES suppliers(id),
  amount           numeric(14,2) NOT NULL CHECK (amount > 0),
  method           payment_method NOT NULL,
  reference        text,
  paid_on          date NOT NULL DEFAULT CURRENT_DATE,
  recorded_by      bigint REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX supplier_payments_paid_on_idx ON supplier_payments (paid_on);

-- ---------------------------------------------------------------------
-- Workforce
-- ---------------------------------------------------------------------
CREATE TABLE attendance_records (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  worker_id        bigint NOT NULL REFERENCES workers(id),
  attendance_date  date NOT NULL,
  shift_id         bigint REFERENCES shifts(id),
  status           attendance_status NOT NULL,
  overtime_hours   numeric(4,2) NOT NULL DEFAULT 0 CHECK (overtime_hours >= 0 AND overtime_hours <= 12),
  marked_by        bigint REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (worker_id, attendance_date)
);
CREATE INDEX attendance_records_date_idx ON attendance_records (attendance_date);

CREATE TABLE payroll_runs (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period_month   date NOT NULL UNIQUE CHECK (extract(day FROM period_month) = 1),
  status         payroll_status NOT NULL DEFAULT 'DRAFT',
  total_net_pay  numeric(14,2) NOT NULL DEFAULT 0,
  generated_by   bigint REFERENCES users(id),
  generated_at   timestamptz NOT NULL DEFAULT now(),
  paid_on        date
);

CREATE TABLE payslips (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payroll_run_id   bigint NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  worker_id        bigint NOT NULL REFERENCES workers(id),
  days_present     numeric(5,1) NOT NULL,
  overtime_hours   numeric(6,2) NOT NULL,
  daily_wage       numeric(10,2) NOT NULL,
  basic_pay        numeric(12,2) NOT NULL,
  overtime_pay     numeric(12,2) NOT NULL,
  deductions       numeric(12,2) NOT NULL DEFAULT 0,
  net_pay          numeric(12,2) NOT NULL,
  UNIQUE (payroll_run_id, worker_id)
);

-- ---------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      bigint REFERENCES users(id),
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    bigint,
  details      jsonb,
  ip_address   inet,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'buyers', 'suppliers', 'users', 'yarn_types', 'fabric_types', 'orders', 'yarn_receipts',
    'machines', 'workers', 'production_jobs', 'fabric_rolls', 'invoices', 'attendance_records'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at()',
      table_name || '_touch_updated_at', table_name
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- Reporting views
-- ---------------------------------------------------------------------
-- Live progress of each order, used by dashboards and the buyer tracking page.
CREATE VIEW order_progress AS
SELECT
  o.id AS order_id,
  o.quantity_meters,
  COALESCE(r.produced_meters, 0)   AS produced_meters,
  COALESCE(r.passed_meters, 0)     AS passed_meters,
  COALESCE(r.pending_qc_meters, 0) AS pending_qc_meters,
  COALESCE(r.rejected_meters, 0)   AS rejected_meters,
  COALESCE(r.dispatched_meters, 0) AS dispatched_meters,
  COALESCE(r.roll_count, 0)        AS roll_count
FROM orders o
LEFT JOIN LATERAL (
  SELECT
    sum(length_meters) FILTER (WHERE status <> 'REJECTED')                 AS produced_meters,
    sum(length_meters) FILTER (WHERE status IN ('PASSED', 'DISPATCHED'))   AS passed_meters,
    sum(length_meters) FILTER (WHERE status IN ('PENDING_QC', 'REWORK'))   AS pending_qc_meters,
    sum(length_meters) FILTER (WHERE status = 'REJECTED')                  AS rejected_meters,
    sum(length_meters) FILTER (WHERE status = 'DISPATCHED')                AS dispatched_meters,
    count(*)                                                               AS roll_count
  FROM fabric_rolls fr
  WHERE fr.order_id = o.id
) r ON true;

-- What every order actually cost: yarn issued + labour + machine running cost.
CREATE VIEW order_costing AS
SELECT
  o.id AS order_id,
  COALESCE(material.cost, 0) AS material_cost,
  COALESCE(floor_cost.labour_cost, 0) AS labour_cost,
  COALESCE(floor_cost.machine_cost, 0) AS machine_cost,
  COALESCE(material.cost, 0) + COALESCE(floor_cost.labour_cost, 0) + COALESCE(floor_cost.machine_cost, 0) AS total_cost
FROM orders o
LEFT JOIN LATERAL (
  SELECT sum(-m.quantity_kg * m.cost_per_kg) AS cost
  FROM yarn_stock_movements m
  WHERE m.order_id = o.id AND m.movement_type IN ('ISSUE', 'RETURN')
) material ON true
LEFT JOIN LATERAL (
  SELECT sum(pl.labour_cost) AS labour_cost, sum(pl.machine_cost) AS machine_cost
  FROM production_logs pl
  JOIN production_jobs pj ON pj.id = pl.production_job_id
  WHERE pj.order_id = o.id
) floor_cost ON true;

-- ---------------------------------------------------------------------
-- Document number sequences (see utils/documentNumbers.js)
-- ---------------------------------------------------------------------
CREATE SEQUENCE document_number_ord_seq;
CREATE SEQUENCE document_number_grn_seq;
CREATE SEQUENCE document_number_job_seq;
CREATE SEQUENCE document_number_rl_seq;
CREATE SEQUENCE document_number_dsp_seq;
CREATE SEQUENCE document_number_inv_seq;
