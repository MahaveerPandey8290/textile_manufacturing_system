// Fast lookups of organisations for every authenticated request.
// Entries live for a short time so a suspension takes effect within seconds even on
// other API instances, while a busy mill doesn't hit platform.organizations on every call.
import { query } from '../../db/pool.js';

const CACHE_TTL_MS = 15_000;
const cacheById = new Map();

const ORGANIZATION_COLUMNS = `id, organization_code, schema_name, name, email_domain, city, phone, gst_number,
  status, logo_updated_at, (logo_data IS NOT NULL) AS has_logo, created_at`;

export async function findOrganizationById(organizationId) {
  const cached = cacheById.get(organizationId);
  if (cached && cached.expiresAt > Date.now()) return cached.organization;
  const { rows } = await query(`SELECT ${ORGANIZATION_COLUMNS} FROM platform.organizations WHERE id = $1`, [organizationId]);
  const organization = rows[0] ?? null;
  if (organization) cacheById.set(organizationId, { organization, expiresAt: Date.now() + CACHE_TTL_MS });
  return organization;
}

export async function findOrganizationByCode(organizationCode) {
  const { rows } = await query(`SELECT ${ORGANIZATION_COLUMNS} FROM platform.organizations WHERE organization_code = $1`, [
    organizationCode,
  ]);
  return rows[0] ?? null;
}

/** Organisations whose staff domain matches this email's domain (usually exactly one). */
export async function findOrganizationsByEmailDomain(email) {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  const { rows } = await query(`SELECT ${ORGANIZATION_COLUMNS} FROM platform.organizations WHERE email_domain = $1 ORDER BY id`, [domain]);
  return rows;
}

export function forgetOrganization(organizationId) {
  cacheById.delete(organizationId);
}

/** What the sign-in screens and the app header show: never the schema or internal id. */
export function toBranding(organization) {
  return {
    code: organization.organization_code,
    name: organization.name,
    city: organization.city,
    emailDomain: organization.email_domain,
    logoUrl: organization.has_logo
      ? `/api/public/organizations/${organization.organization_code}/logo?v=${new Date(organization.logo_updated_at).getTime()}`
      : null,
  };
}
