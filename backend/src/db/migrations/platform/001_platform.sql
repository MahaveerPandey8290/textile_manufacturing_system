-- =====================================================================
-- Platform schema: everything shared across organisations.
--
-- Multi-tenancy model: schema per tenant.
--   * platform.*        organisations, super admins, platform activity
--   * tenant_<code>.*   one full copy of the mill schema per organisation
--                       (see ../tenant). Business data never shares a table
--                       across organisations, so a missing WHERE clause can
--                       never leak another mill's data.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE SCHEMA IF NOT EXISTS platform;

CREATE TYPE platform.organization_status AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TABLE platform.organizations (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Short code staff type to find their organisation, e.g. EVR-K7M2Q.
  organization_code  text NOT NULL UNIQUE CHECK (organization_code ~ '^[A-Z0-9]{3}-[A-Z0-9]{5}$'),
  schema_name        text NOT NULL UNIQUE CHECK (schema_name ~ '^tenant_[a-z0-9_]+$'),
  name               text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  -- Staff must sign in with an address on this domain (taken from the founder's work email).
  email_domain       text NOT NULL CHECK (email_domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  city               text NOT NULL,
  phone              text,
  gst_number         text,
  logo_data          bytea,
  logo_mime_type     text CHECK (logo_mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  logo_updated_at    timestamptz,
  status             platform.organization_status NOT NULL DEFAULT 'ACTIVE',
  suspended_reason   text,
  suspended_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_logo_pair CHECK ((logo_data IS NULL) = (logo_mime_type IS NULL))
);
CREATE INDEX organizations_name_trgm ON platform.organizations USING gin (name public.gin_trgm_ops);
CREATE INDEX organizations_created_idx ON platform.organizations (created_at DESC);

-- People who run the platform itself. They never belong to an organisation.
CREATE TABLE platform.platform_admins (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name      text NOT NULL,
  email          text NOT NULL,
  password_hash  text NOT NULL,
  is_active      boolean NOT NULL DEFAULT true,
  last_login_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX platform_admins_email_unique ON platform.platform_admins (lower(email));

-- What is happening across the platform: sign-ups, sign-ins, resets, suspensions.
-- The super admin console reads this; each organisation keeps its own detailed audit_logs.
CREATE TABLE platform.platform_events (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id  bigint REFERENCES platform.organizations(id) ON DELETE CASCADE,
  event_type       text NOT NULL,
  actor_email      text,
  details          jsonb,
  ip_address       inet,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_events_created_idx ON platform.platform_events (created_at DESC);
CREATE INDEX platform_events_org_idx ON platform.platform_events (organization_id, created_at DESC);
CREATE INDEX platform_events_type_idx ON platform.platform_events (event_type, created_at DESC);

CREATE FUNCTION platform.touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_touch_updated_at BEFORE UPDATE ON platform.organizations
  FOR EACH ROW EXECUTE FUNCTION platform.touch_updated_at();
