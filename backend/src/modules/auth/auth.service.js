import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';
import { query, runInTenantSchema, withTransaction } from '../../db/pool.js';
import { SESSION_SCOPES, signSession } from '../../middleware/authentication.js';
import { badRequest, HttpError, unauthorized } from '../../utils/httpError.js';
import { sendMail } from '../../utils/mailer.js';
import { recordPlatformEvent } from '../../utils/platformEvents.js';
import { findOrganizationByCode, findOrganizationById, findOrganizationsByEmailDomain, toBranding } from '../organizations/organizationRegistry.js';

// A real hash of a random string so unknown emails cost the same time as wrong passwords
// (prevents discovering valid emails by timing the response).
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('timing-attack-guard', 10);
const STAFF_SIGN_IN_FAILED = 'Role, email or password is incorrect.';
const ADMIN_SIGN_IN_FAILED = 'Email or password is incorrect. Staff members sign in with their organisation code.';
const SUSPENDED = 'This organisation has been suspended. Contact the platform team.';
const CODE_LIFETIME_MINUTES = 10;
const CODE_MAX_ATTEMPTS = 5;
const CODE_RESEND_SECONDS = 60;
const RESET_TOKEN_MINUTES = 15;

async function findActiveOrganization(organizationCode) {
  const organization = await findOrganizationByCode(organizationCode);
  if (!organization) throw unauthorized('We could not find an organisation with that code.');
  if (organization.status !== 'ACTIVE') throw new HttpError(403, SUSPENDED);
  return organization;
}

const USER_COLUMNS = `u.id, u.full_name, u.email, u.password_hash, u.role, u.buyer_id, u.is_active, u.activated_at, b.company_name AS buyer_company`;

/**
 * The organisation an owner belongs to, found from their work email alone (the organisation admin
 * sign-in has no code). Several organisations may share a domain, so each candidate is checked
 * for an owner with this email.
 */
async function findOwnerByEmail(email) {
  for (const organization of await findOrganizationsByEmailDomain(email)) {
    const user = await runInTenantSchema(organization.schema_name, async () => {
      const { rows } = await query(
        `SELECT ${USER_COLUMNS} FROM users u LEFT JOIN buyers b ON b.id = u.buyer_id
          WHERE lower(u.email) = lower($1) AND u.role = 'OWNER'`,
        [email],
      );
      return rows[0];
    });
    if (user) return { organization, user };
  }
  return { organization: null, user: null };
}

/** Which organisation a code request is about: by its code (staff), or by the owner's email (admin). */
async function organizationForAccount({ organizationCode, email }) {
  if (organizationCode) return findActiveOrganization(organizationCode);
  const { organization } = await findOwnerByEmail(email);
  return organization?.status === 'ACTIVE' ? organization : null;
}

async function startTenantSession(organization, user, ip) {
  await runInTenantSchema(organization.schema_name, () => query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]));
  await recordPlatformEvent(query, { organizationId: organization.id, eventType: 'SIGNED_IN', actorEmail: user.email, details: { role: user.role }, ip });
  const token = signSession({
    sub: String(user.id),
    scope: SESSION_SCOPES.TENANT,
    org: organization.id,
    role: user.role,
    buyerId: user.buyer_id,
    name: user.full_name,
    email: user.email,
  });
  return { token, session: { kind: 'tenant', user: toPublicUser(user), organization: toBranding(organization) } };
}

// ------------------------------------------------------------------ organisation admins
/** "Welcome back" sign-in for the organisation's owner: work email and password, no code. */
export async function signInOrganizationAdmin({ email, password }, { ip }) {
  const { organization, user } = await findOwnerByEmail(email);
  const passwordMatches = await bcrypt.compare(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordMatches || !user.is_active) {
    if (organization) await recordPlatformEvent(query, { organizationId: organization.id, eventType: 'SIGN_IN_FAILED', actorEmail: email.toLowerCase(), ip });
    throw unauthorized(ADMIN_SIGN_IN_FAILED);
  }
  if (organization.status !== 'ACTIVE') throw new HttpError(403, SUSPENDED);
  return startTenantSession(organization, user, ip);
}

// ------------------------------------------------------------------ staff and buyers
export async function signInStaff({ organizationCode, role, email, password }, { ip }) {
  const organization = await findActiveOrganization(organizationCode);
  const user = await runInTenantSchema(organization.schema_name, async () => {
    const { rows } = await query(
      `SELECT ${USER_COLUMNS} FROM users u LEFT JOIN buyers b ON b.id = u.buyer_id WHERE lower(u.email) = lower($1)`,
      [email],
    );
    return rows[0];
  });

  const passwordMatches = await bcrypt.compare(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordMatches || !user.is_active || user.role !== role) {
    await recordPlatformEvent(query, { organizationId: organization.id, eventType: 'SIGN_IN_FAILED', actorEmail: email.toLowerCase(), ip });
    throw unauthorized(STAFF_SIGN_IN_FAILED);
  }

  return startTenantSession(organization, user, ip);
}

/** Called right after sign-up so the founder lands in their new workspace. */
export async function sessionForNewOwner(organizationId, ownerId) {
  const organization = await findOrganizationById(organizationId);
  const user = await runInTenantSchema(organization.schema_name, async () => (await query(`SELECT id, full_name, email, role, buyer_id FROM users WHERE id = $1`, [ownerId])).rows[0]);
  const token = signSession({ sub: String(user.id), scope: SESSION_SCOPES.TENANT, org: organization.id, role: user.role, buyerId: null, name: user.full_name, email: user.email });
  return { token, session: { kind: 'tenant', user: toPublicUser(user), organization: toBranding(organization) } };
}

// ------------------------------------------------------------------ platform admins
export async function signInPlatformAdmin({ email, password }, { ip }) {
  const { rows } = await query('SELECT id, full_name, email, password_hash, is_active FROM platform.platform_admins WHERE lower(email) = lower($1)', [email]);
  const admin = rows[0];
  const passwordMatches = await bcrypt.compare(password, admin?.password_hash ?? DUMMY_PASSWORD_HASH);
  if (!admin || !passwordMatches || !admin.is_active) throw unauthorized('Email or password is incorrect.');
  await query('UPDATE platform.platform_admins SET last_login_at = now() WHERE id = $1', [admin.id]);
  await recordPlatformEvent(query, { eventType: 'PLATFORM_ADMIN_SIGNED_IN', actorEmail: admin.email, ip });
  const token = signSession({ sub: String(admin.id), scope: SESSION_SCOPES.PLATFORM, name: admin.full_name, email: admin.email });
  return { token, session: toPlatformSession(admin) };
}

// ------------------------------------------------------------------ current session
export async function getSession(sessionPayload) {
  if (sessionPayload.scope === SESSION_SCOPES.PLATFORM) {
    const { rows } = await query('SELECT id, full_name, email, is_active FROM platform.platform_admins WHERE id = $1', [Number(sessionPayload.sub)]);
    if (!rows[0]?.is_active) throw unauthorized();
    return toPlatformSession(rows[0]);
  }
  const organization = await findOrganizationById(Number(sessionPayload.org));
  if (!organization) throw unauthorized();
  if (organization.status !== 'ACTIVE') throw new HttpError(403, 'Your organisation has been suspended. Contact the platform team.');
  const user = await runInTenantSchema(organization.schema_name, async () => {
    const { rows } = await query(
      `SELECT u.id, u.full_name, u.email, u.role, u.buyer_id, u.is_active, b.company_name AS buyer_company
         FROM users u LEFT JOIN buyers b ON b.id = u.buyer_id WHERE u.id = $1`,
      [Number(sessionPayload.sub)],
    );
    return rows[0];
  });
  if (!user?.is_active) throw unauthorized();
  return { kind: 'tenant', user: toPublicUser(user), organization: toBranding(organization) };
}

export async function changePassword(sessionPayload, { currentPassword, newPassword }) {
  const table = sessionPayload.scope === SESSION_SCOPES.PLATFORM ? 'platform.platform_admins' : 'users';
  const run = async () => {
    const { rows } = await query(`SELECT password_hash FROM ${table} WHERE id = $1`, [Number(sessionPayload.sub)]);
    const isCurrentCorrect = rows[0]?.password_hash && (await bcrypt.compare(currentPassword, rows[0].password_hash));
    if (!isCurrentCorrect) throw unauthorized('Current password is incorrect.');
    await query(`UPDATE ${table} SET password_hash = $2 WHERE id = $1`, [Number(sessionPayload.sub), await bcrypt.hash(newPassword, 12)]);
  };
  if (sessionPayload.scope === SESSION_SCOPES.PLATFORM) return run();
  const organization = await findOrganizationById(Number(sessionPayload.org));
  return runInTenantSchema(organization.schema_name, run);
}

// ------------------------------------------------------------------ forgot password / first-time setup
// 1. request a 6-digit code by email  2. verify it -> short-lived reset token  3. set the new password.
// The same flow activates invited accounts, which have no password yet.
const hashCode = (userId, code) => createHmac('sha256', config.JWT_SECRET).update(`${userId}:${code}`).digest('hex');

export async function requestPasswordCode({ organizationCode, email }, { ip }) {
  const organization = await organizationForAccount({ organizationCode, email });
  // Same answer whether or not the account exists, so the form can't be used to discover people.
  if (!organization) return { codeLifetimeMinutes: CODE_LIFETIME_MINUTES, resendAfterSeconds: CODE_RESEND_SECONDS };
  await runInTenantSchema(organization.schema_name, async () => {
    const { rows } = await query('SELECT id, full_name, email, activated_at FROM users WHERE lower(email) = lower($1) AND is_active', [email]);
    const user = rows[0];
    // Unknown emails get the same answer as known ones, so the form can't be used to discover staff.
    if (!user) return;
    const { rows: recent } = await query(
      `SELECT 1 FROM password_reset_codes WHERE user_id = $1 AND created_at > now() - make_interval(secs => $2)`,
      [user.id, CODE_RESEND_SECONDS],
    );
    if (recent.length) return;

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await query(
      `INSERT INTO password_reset_codes (user_id, code_hash, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3))`,
      [user.id, hashCode(user.id, code), CODE_LIFETIME_MINUTES],
    );
    const isFirstTime = !user.activated_at;
    await sendMail({
      to: user.email,
      subject: isFirstTime ? `Set up your ${organization.name} account` : `Your ${organization.name} password reset code`,
      text: [
        `Hello ${user.full_name},`,
        '',
        isFirstTime
          ? `Use this code to set up your account at ${organization.name}:`
          : `Use this code to reset your password at ${organization.name}:`,
        '',
        `    ${code}`,
        '',
        `It expires in ${CODE_LIFETIME_MINUTES} minutes. Organisation code: ${organization.organization_code}.`,
        `Didn't ask for this? You can ignore this email.`,
      ].join('\n'),
    });
    await recordPlatformEvent(query, {
      organizationId: organization.id,
      eventType: isFirstTime ? 'ACCOUNT_SETUP_REQUESTED' : 'PASSWORD_RESET_REQUESTED',
      actorEmail: user.email,
      ip,
    });
  });
  return { codeLifetimeMinutes: CODE_LIFETIME_MINUTES, resendAfterSeconds: CODE_RESEND_SECONDS };
}

const WRONG_CODE = 'That code is incorrect or has expired. Check the latest email or request a new code.';

export async function verifyPasswordCode({ organizationCode, email, code }) {
  const organization = await organizationForAccount({ organizationCode, email });
  if (!organization) throw badRequest(WRONG_CODE);
  return runInTenantSchema(organization.schema_name, () =>
    withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT c.id, c.user_id, c.code_hash, c.failed_attempts, c.expires_at < now() AS is_expired, u.activated_at
           FROM password_reset_codes c JOIN users u ON u.id = c.user_id
          WHERE lower(u.email) = lower($1) AND u.is_active AND c.consumed_at IS NULL
          ORDER BY c.created_at DESC LIMIT 1
          FOR UPDATE OF c`,
        [email],
      );
      const pending = rows[0];
      if (!pending || pending.is_expired || pending.failed_attempts >= CODE_MAX_ATTEMPTS) throw badRequest(WRONG_CODE);

      const expected = Buffer.from(pending.code_hash, 'hex');
      const actual = Buffer.from(hashCode(pending.user_id, code), 'hex');
      if (!timingSafeEqual(expected, actual)) {
        await client.query('UPDATE password_reset_codes SET failed_attempts = failed_attempts + 1 WHERE id = $1', [pending.id]);
        // Commit the failed attempt even though we answer with an error.
        return { wrongCode: true };
      }
      await client.query('UPDATE password_reset_codes SET verified_at = now() WHERE id = $1', [pending.id]);
      const resetToken = jwt.sign(
        { purpose: 'password-reset', org: organization.id, sub: String(pending.user_id), codeId: pending.id },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: `${RESET_TOKEN_MINUTES}m` },
      );
      return { resetToken, isFirstTime: !pending.activated_at };
    }),
  ).then((result) => {
    if (result.wrongCode) throw badRequest(WRONG_CODE);
    return result;
  });
}

export async function resetPassword({ resetToken, newPassword }, { ip }) {
  let claims;
  try {
    claims = jwt.verify(resetToken, config.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    throw badRequest('This reset link has expired. Please start again.');
  }
  if (claims.purpose !== 'password-reset') throw badRequest('This reset link is not valid.');
  const organization = await findOrganizationById(Number(claims.org));
  if (!organization || organization.status !== 'ACTIVE') throw badRequest('This reset link is not valid.');

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const outcome = await runInTenantSchema(organization.schema_name, () =>
    withTransaction(async (client) => {
      // Single use: the code must be verified, not yet consumed, and belong to this user.
      const { rows } = await client.query(
        `UPDATE password_reset_codes SET consumed_at = now()
          WHERE id = $1 AND user_id = $2 AND verified_at IS NOT NULL AND consumed_at IS NULL
          RETURNING id`,
        [claims.codeId, Number(claims.sub)],
      );
      if (!rows[0]) throw badRequest('This reset link has already been used. Please start again.');
      const { rows: users } = await client.query('SELECT email, activated_at FROM users WHERE id = $1 FOR UPDATE', [Number(claims.sub)]);
      await client.query('UPDATE users SET password_hash = $2, activated_at = COALESCE(activated_at, now()) WHERE id = $1', [
        Number(claims.sub),
        passwordHash,
      ]);
      // Any other outstanding codes for this person are now useless.
      await client.query('UPDATE password_reset_codes SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL', [Number(claims.sub)]);
      return { email: users[0].email, activatedNow: !users[0].activated_at };
    }),
  );
  await recordPlatformEvent(query, {
    organizationId: organization.id,
    eventType: outcome.activatedNow ? 'ACCOUNT_ACTIVATED' : 'PASSWORD_RESET_COMPLETED',
    actorEmail: outcome.email,
    ip,
  });
  return { accountCreated: outcome.activatedNow, organization: toBranding(organization) };
}

// ------------------------------------------------------------------ shapes
function toPublicUser(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    buyerId: user.buyer_id ?? null,
    buyerCompany: user.buyer_company ?? null,
  };
}

function toPlatformSession(admin) {
  return { kind: 'platform', user: { id: admin.id, fullName: admin.full_name, email: admin.email, role: 'SUPER_ADMIN' }, organization: null };
}
