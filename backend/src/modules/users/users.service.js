import { query, withTransaction } from '../../db/pool.js';
import { recordAudit } from '../../utils/auditLog.js';
import { belongsToDomain } from '../../utils/emailDomains.js';
import { badRequest, notFound } from '../../utils/httpError.js';
import { sendMail } from '../../utils/mailer.js';
import { toLikePattern, toOffset, toPage } from '../../utils/pagination.js';
import { recordPlatformEvent } from '../../utils/platformEvents.js';

const USER_COLUMNS = `u.id, u.full_name, u.email, u.role, u.buyer_id, b.company_name AS buyer_company,
                      u.is_active, u.last_login_at, u.created_at,
                      CASE WHEN NOT u.is_active THEN 'DISABLED' WHEN u.activated_at IS NULL THEN 'INVITED' ELSE 'ACTIVE' END AS status`;

export async function listUsers({ search, page, pageSize }) {
  const { rows } = await query(
    `SELECT ${USER_COLUMNS}, count(*) OVER () AS total_count
       FROM users u LEFT JOIN buyers b ON b.id = u.buyer_id
      WHERE ($1 = '' OR u.full_name ILIKE $2 OR u.email ILIKE $2)
      ORDER BY u.full_name
      LIMIT $3 OFFSET $4`,
    [search, toLikePattern(search), pageSize, toOffset({ page, pageSize })],
  );
  return toPage(rows, { page, pageSize });
}

/**
 * Invite someone to the organisation. They get no password: they set their own through
 * "First time here?" on the sign-in screen, which emails them a one-time code.
 */
export async function createUser(request, { fullName, email, role, buyerId }) {
  if ((role === 'BUYER') !== Boolean(buyerId)) {
    throw badRequest('Buyer accounts must be linked to a buyer, and only buyer accounts can be.');
  }
  const { organization } = request;
  if (role !== 'BUYER' && !belongsToDomain(email, organization.email_domain)) {
    throw badRequest(`Staff must use their @${organization.email_domain} work email.`, [
      { field: 'email', message: `Use an @${organization.email_domain} address.` },
    ]);
  }
  const created = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO users (full_name, email, role, buyer_id) VALUES ($1, $2, $3, $4) RETURNING id`,
      [fullName, email.toLowerCase(), role, buyerId ?? null],
    );
    await recordAudit(client, { request, action: 'USER_INVITED', entityType: 'user', entityId: rows[0].id, details: { email, role } });
    await recordPlatformEvent(client, {
      organizationId: organization.id,
      eventType: 'USER_INVITED',
      actorEmail: request.user.email,
      details: { invited: email.toLowerCase(), role },
      ip: request.ip,
    });
    return rows[0];
  });
  await sendMail({
    to: email,
    subject: `You've been invited to ${organization.name}`,
    text: [
      `Hello ${fullName},`,
      '',
      `${request.user.fullName} has added you to ${organization.name} as ${role.replaceAll('_', ' ').toLowerCase()}.`,
      '',
      `1. Open the sign-in page and choose "Sign in as staff".`,
      `2. Enter the organisation code: ${organization.organization_code}`,
      `3. Choose "First time here? Set up your account" and follow the steps.`,
    ].join('\n'),
  });
  return created;
}

export async function updateUser(request, userId, { fullName, role, buyerId, isActive }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE users SET
         full_name = COALESCE($2, full_name),
         role = COALESCE($3, role),
         buyer_id = CASE WHEN $3::user_role IS NULL THEN buyer_id ELSE $4 END,
         is_active = COALESCE($5, is_active)
       WHERE id = $1 RETURNING id`,
      [userId, fullName ?? null, role ?? null, buyerId ?? null, isActive ?? null],
    );
    if (!rows[0]) throw notFound('User');
    await recordAudit(client, { request, action: 'USER_UPDATED', entityType: 'user', entityId: userId, details: { role, isActive } });
    return rows[0];
  });
}
