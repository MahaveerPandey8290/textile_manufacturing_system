// Super admin console: watch every organisation on the platform.
// Organisation data lives in separate schemas, so cross-organisation numbers are gathered with
// one UNION ALL over the schemas involved (names come from platform.organizations and are
// validated before use). Business records themselves are never exposed here, only counts.
import { query, withTransaction } from '../../db/pool.js';
import { badRequest, notFound } from '../../utils/httpError.js';
import { toLikePattern, toOffset, toPage } from '../../utils/pagination.js';
import { recordPlatformEvent } from '../../utils/platformEvents.js';
import { forgetOrganization, toBranding } from '../organizations/organizationRegistry.js';

const SAFE_SCHEMA = /^tenant_[a-z0-9_]+$/;

/** Usage numbers for each schema, keyed by schema name. Chunked in batches of 35 to prevent query planner timeouts. */
async function statsForSchemas(schemaNames, chunkSize = 35) {
  const safeNames = schemaNames.filter((name) => SAFE_SCHEMA.test(name));
  if (!safeNames.length) return new Map();

  const chunks = [];
  for (let i = 0; i < safeNames.length; i += chunkSize) {
    chunks.push(safeNames.slice(i, i + chunkSize));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const sql = chunk
        .map(
          (schema) => `SELECT '${schema}'::text AS schema_name,
            (SELECT count(*) FROM "${schema}".users) AS user_count,
            (SELECT count(*) FROM "${schema}".users WHERE activated_at IS NOT NULL AND is_active) AS active_user_count,
            (SELECT count(*) FROM "${schema}".users WHERE activated_at IS NULL AND is_active) AS invited_user_count,
            (SELECT count(*) FROM "${schema}".orders) AS order_count,
            (SELECT count(*) FROM "${schema}".orders WHERE status NOT IN ('DISPATCHED', 'CANCELLED')) AS open_order_count,
            (SELECT count(*) FROM "${schema}".machines) AS machine_count,
            (SELECT COALESCE(sum(total_amount), 0) FROM "${schema}".invoices WHERE invoice_date >= date_trunc('month', CURRENT_DATE)) AS revenue_this_month,
            (SELECT max(last_login_at) FROM "${schema}".users) AS last_sign_in_at`,
        )
        .join('\nUNION ALL\n');
      const { rows } = await query(sql);
      return rows;
    }),
  );

  return new Map(results.flat().map((row) => [row.schema_name, row]));
}

const EMPTY_STATS = {
  user_count: 0, active_user_count: 0, invited_user_count: 0, order_count: 0, open_order_count: 0,
  machine_count: 0, revenue_this_month: 0, last_sign_in_at: null,
};

function toOrganizationSummary(organization, stats) {
  const { schema_name: _schema, logo_updated_at: _logo, has_logo: _hasLogo, total_count: _count, ...rest } = organization;
  const { schema_name: _statsSchema, ...usage } = stats ?? EMPTY_STATS;
  return { ...rest, logo_url: toBranding(organization).logoUrl, ...usage };
}

const ORGANIZATION_COLUMNS = `o.id, o.organization_code, o.schema_name, o.name, o.email_domain, o.city, o.phone, o.gst_number,
  o.status, o.suspended_reason, o.suspended_at, o.created_at, o.logo_updated_at, (o.logo_data IS NOT NULL) AS has_logo`;

export async function getOverview() {
  const [{ rows: counts }, { rows: signups }, { rows: activity }, { rows: organizations }, { rows: recentEvents }] = await Promise.all([
    query(`SELECT count(*) AS total,
                  count(*) FILTER (WHERE status = 'ACTIVE') AS active,
                  count(*) FILTER (WHERE status = 'SUSPENDED') AS suspended,
                  count(*) FILTER (WHERE created_at >= now() - interval '30 days') AS new_last_30_days
             FROM platform.organizations`),
    query(`SELECT day::date AS day, count(o.id) AS signups
             FROM generate_series(CURRENT_DATE - 29, CURRENT_DATE, interval '1 day') AS day
             LEFT JOIN platform.organizations o ON o.created_at::date = day::date
            GROUP BY day ORDER BY day`),
    query(`SELECT count(*) FILTER (WHERE event_type = 'SIGNED_IN') AS sign_ins,
                  count(*) FILTER (WHERE event_type = 'SIGN_IN_FAILED') AS failed_sign_ins,
                  count(*) FILTER (WHERE event_type IN ('PASSWORD_RESET_COMPLETED', 'ACCOUNT_ACTIVATED')) AS password_resets,
                  count(DISTINCT actor_email) FILTER (WHERE event_type = 'SIGNED_IN') AS people_signed_in
             FROM platform.platform_events WHERE created_at >= now() - interval '7 days'`),
    query(`SELECT ${ORGANIZATION_COLUMNS} FROM platform.organizations o WHERE o.status = 'ACTIVE'`),
    query(`SELECT e.id, e.event_type, e.actor_email, e.details, e.created_at, o.name AS organization_name, o.organization_code
             FROM platform.platform_events e LEFT JOIN platform.organizations o ON o.id = e.organization_id
            ORDER BY e.created_at DESC, e.id DESC LIMIT 12`),
  ]);

  const stats = await statsForSchemas(organizations.map((organization) => organization.schema_name));
  const totals = { users: 0, activeUsers: 0, orders: 0, openOrders: 0, machines: 0, revenueThisMonth: 0 };
  for (const row of stats.values()) {
    totals.users += row.user_count;
    totals.activeUsers += row.active_user_count;
    totals.orders += row.order_count;
    totals.openOrders += row.open_order_count;
    totals.machines += row.machine_count;
    totals.revenueThisMonth += row.revenue_this_month;
  }
  const topOrganizations = organizations
    .map((organization) => toOrganizationSummary(organization, stats.get(organization.schema_name)))
    .sort((left, right) => right.open_order_count - left.open_order_count)
    .slice(0, 5);

  return { organizations: counts[0], totals, lastSevenDays: activity[0], signups, topOrganizations, recentEvents };
}

export async function listOrganizations({ search, status, page, pageSize }) {
  const { rows } = await query(
    `SELECT ${ORGANIZATION_COLUMNS}, count(*) OVER () AS total_count
       FROM platform.organizations o
      WHERE ($1 = '' OR o.name ILIKE $2 OR o.organization_code ILIKE $2 OR o.city ILIKE $2 OR o.email_domain ILIKE $2)
        AND ($3::platform.organization_status IS NULL OR o.status = $3)
      ORDER BY o.created_at DESC
      LIMIT $4 OFFSET $5`,
    [search, toLikePattern(search), status ?? null, pageSize, toOffset({ page, pageSize })],
  );
  const stats = await statsForSchemas(rows.map((row) => row.schema_name));
  const result = toPage(rows, { page, pageSize });
  result.items = rows.map((row) => toOrganizationSummary(row, stats.get(row.schema_name)));
  return result;
}

async function loadOrganization(organizationId) {
  const { rows } = await query(`SELECT ${ORGANIZATION_COLUMNS} FROM platform.organizations o WHERE o.id = $1`, [organizationId]);
  if (!rows[0]) throw notFound('Organisation');
  return rows[0];
}

export async function getOrganization(organizationId) {
  const organization = await loadOrganization(organizationId);
  const schema = organization.schema_name;
  if (!SAFE_SCHEMA.test(schema)) throw badRequest('Organisation schema is not valid.');

  const [stats, { rows: people }, { rows: activity }, { rows: events }] = await Promise.all([
    statsForSchemas([schema]),
    query(`SELECT id, full_name, email, role, is_active, activated_at, last_login_at, created_at
             FROM "${schema}".users ORDER BY (role = 'OWNER') DESC, full_name`),
    query(`SELECT a.id, a.action, a.entity_type, a.created_at, u.full_name AS user_name
             FROM "${schema}".audit_logs a LEFT JOIN "${schema}".users u ON u.id = a.user_id
            ORDER BY a.created_at DESC, a.id DESC LIMIT 15`),
    query(`SELECT id, event_type, actor_email, details, created_at FROM platform.platform_events
            WHERE organization_id = $1 ORDER BY created_at DESC, id DESC LIMIT 15`, [organizationId]),
  ]);
  return {
    ...toOrganizationSummary(organization, stats.get(schema)),
    people: people.map((person) => ({
      ...person,
      status: !person.is_active ? 'DISABLED' : person.activated_at ? 'ACTIVE' : 'INVITED',
    })),
    recentActivity: activity,
    recentEvents: events,
  };
}

export async function setOrganizationStatus(request, organizationId, { status, reason }) {
  if (status === 'SUSPENDED' && !reason) throw badRequest('Give a reason so the organisation knows why.');
  await withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE platform.organizations
          SET status = $2::platform.organization_status,
              suspended_reason = CASE WHEN $2::platform.organization_status = 'SUSPENDED' THEN $3 END,
              suspended_at = CASE WHEN $2::platform.organization_status = 'SUSPENDED' THEN now() END
        WHERE id = $1 RETURNING id`,
      [organizationId, status, reason ?? null],
    );
    if (!rows[0]) throw notFound('Organisation');
    await recordPlatformEvent(client, {
      organizationId,
      eventType: status === 'SUSPENDED' ? 'ORGANIZATION_SUSPENDED' : 'ORGANIZATION_REACTIVATED',
      actorEmail: request.user.email,
      details: reason ? { reason } : null,
      ip: request.ip,
    });
  });
  forgetOrganization(organizationId);
  return getOrganization(organizationId);
}

export async function listEvents({ search, organizationId, eventType, page, pageSize }) {
  const { rows } = await query(
    `SELECT e.id, e.event_type, e.actor_email, e.details, host(e.ip_address) AS ip_address, e.created_at,
            o.id AS organization_id, o.name AS organization_name, o.organization_code,
            count(*) OVER () AS total_count
       FROM platform.platform_events e
       LEFT JOIN platform.organizations o ON o.id = e.organization_id
      WHERE ($1 = '' OR e.actor_email ILIKE $2 OR o.name ILIKE $2)
        AND ($3::bigint IS NULL OR e.organization_id = $3)
        AND ($4::text IS NULL OR e.event_type = $4)
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT $5 OFFSET $6`,
    [search, toLikePattern(search), organizationId ?? null, eventType ?? null, pageSize, toOffset({ page, pageSize })],
  );
  return toPage(rows, { page, pageSize });
}
