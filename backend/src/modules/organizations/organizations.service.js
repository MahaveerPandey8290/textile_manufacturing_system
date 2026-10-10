import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../../db/pool.js';
import { applyTenantMigrations } from '../../db/migrations.js';
import { recordAudit } from '../../utils/auditLog.js';
import { emailDomainOf } from '../../utils/emailDomains.js';
import { notFound } from '../../utils/httpError.js';
import { parseLogoDataUrl } from '../../utils/logoImage.js';
import { generateOrganizationCode, schemaNameForCode } from '../../utils/organizationCode.js';
import { recordPlatformEvent } from '../../utils/platformEvents.js';
import { findOrganizationByCode, findOrganizationById, forgetOrganization, toBranding } from './organizationRegistry.js';

const DEFAULT_SHIFTS = [
  ['Morning', '06:00', '14:00'],
  ['Evening', '14:00', '22:00'],
  ['Night', '22:00', '06:00'],
];
const MAX_CODE_ATTEMPTS = 5;

/**
 * Sign-up: create the organisation, its own database schema, and its owner account in one
 * transaction. If anything fails, nothing is left behind (PostgreSQL DDL is transactional).
 */
export async function registerOrganization({ organization, owner }, { ip, organizationCode: fixedCode } = {}) {
  const logo = organization.logo ? parseLogoDataUrl(organization.logo) : null;
  const passwordHash = await bcrypt.hash(owner.password, 12);
  const emailDomain = emailDomainOf(owner.email);

  for (let attempt = 1; ; attempt += 1) {
    const organizationCode = fixedCode ?? generateOrganizationCode(organization.name);
    try {
      return await withTransaction(async (client) => {
        const schemaName = schemaNameForCode(organizationCode);
        const { rows } = await client.query(
          `INSERT INTO platform.organizations
             (organization_code, schema_name, name, email_domain, city, phone, gst_number, logo_data, logo_mime_type, logo_updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $8::bytea IS NULL THEN NULL ELSE now() END)
           RETURNING id`,
          [organizationCode, schemaName, organization.name, emailDomain, organization.city, organization.phone || null,
            organization.gstNumber || null, logo?.data ?? null, logo?.mimeType ?? null],
        );
        const organizationId = rows[0].id;

        await applyTenantMigrations(client, schemaName);
        const { rows: ownerRows } = await client.query(
          `INSERT INTO users (full_name, email, password_hash, role, activated_at) VALUES ($1, $2, $3, 'OWNER', now()) RETURNING id`,
          [owner.fullName, owner.email.toLowerCase(), passwordHash],
        );
        for (const shift of DEFAULT_SHIFTS) {
          await client.query('INSERT INTO shifts (name, starts_at, ends_at) VALUES ($1, $2, $3)', shift);
        }
        const ownerId = ownerRows[0].id;
        await recordAudit(client, {
          request: { user: { id: ownerId }, ip },
          action: 'ORGANIZATION_CREATED',
          entityType: 'organization',
          entityId: organizationId,
          details: { organizationCode },
        });
        await recordPlatformEvent(client, {
          organizationId,
          eventType: 'ORGANIZATION_SIGNED_UP',
          actorEmail: owner.email.toLowerCase(),
          details: { name: organization.name, city: organization.city },
          ip,
        });
        return { organizationId, organizationCode, schemaName, ownerId };
      });
    } catch (error) {
      const codeTaken = error.code === '23505' && /organization_code|schema_name/.test(error.constraint ?? '');
      if (!codeTaken || fixedCode || attempt >= MAX_CODE_ATTEMPTS) throw error;
    }
  }
}

/** Public: what the staff sign-in screen shows after someone types a code. */
export async function getBrandingByCode(organizationCode) {
  const organization = await findOrganizationByCode(organizationCode);
  // Unknown and suspended look the same from outside, so codes can't be probed for status.
  if (!organization || organization.status !== 'ACTIVE') throw notFound('Organisation');
  return toBranding(organization);
}

export async function getLogo(organizationCode) {
  const { rows } = await query(
    'SELECT logo_data, logo_mime_type, logo_updated_at FROM platform.organizations WHERE organization_code = $1 AND logo_data IS NOT NULL',
    [organizationCode],
  );
  if (!rows[0]) throw notFound('Logo');
  return rows[0];
}

export async function getProfile(organizationId) {
  const organization = await findOrganizationById(organizationId);
  if (!organization) throw notFound('Organisation');
  return {
    ...toBranding(organization),
    phone: organization.phone,
    gstNumber: organization.gst_number,
    createdAt: organization.created_at,
  };
}

export async function updateProfile(request, organizationId, changes) {
  const { name, city, phone, gstNumber, logo } = changes;
  const parsedLogo = logo ? parseLogoDataUrl(logo) : null;
  const { rows } = await query(
    `UPDATE platform.organizations SET
       name = COALESCE($2, name),
       city = COALESCE($3, city),
       phone = CASE WHEN $4::boolean THEN $5 ELSE phone END,
       gst_number = CASE WHEN $6::boolean THEN $7 ELSE gst_number END,
       logo_data = CASE WHEN $8::boolean THEN $9 ELSE logo_data END,
       logo_mime_type = CASE WHEN $8::boolean THEN $10 ELSE logo_mime_type END,
       logo_updated_at = CASE WHEN $8::boolean THEN now() ELSE logo_updated_at END
     WHERE id = $1 RETURNING id`,
    [organizationId, name ?? null, city ?? null, phone !== undefined, phone || null, gstNumber !== undefined, gstNumber || null,
      logo !== undefined, parsedLogo?.data ?? null, parsedLogo?.mimeType ?? null],
  );
  if (!rows[0]) throw notFound('Organisation');
  forgetOrganization(organizationId);
  await recordPlatformEvent(query, {
    organizationId,
    eventType: 'ORGANIZATION_PROFILE_UPDATED',
    actorEmail: request.user.email ?? null,
    details: { fields: Object.keys(changes) },
    ip: request.ip,
  });
  return getProfile(organizationId);
}
