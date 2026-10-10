import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';
import { config } from '../config/env.js';

// Return NUMERIC / BIGINT as JS numbers. Values in this domain (meters, kg, rupees)
// stay far below Number.MAX_SAFE_INTEGER, so this is safe and keeps the API simple.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => (value === null ? null : Number(value)));
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => (value === null ? null : Number(value)));
// Plain DATE columns stay as 'YYYY-MM-DD' strings so time zones never shift them.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

export const pool = new pg.Pool({
  host: config.DATABASE_HOST,
  port: config.DATABASE_PORT,
  database: config.DATABASE_NAME,
  user: config.DATABASE_USER,
  password: config.DATABASE_PASSWORD,
  max: config.DATABASE_POOL_SIZE,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  // Server side: PostgreSQL cancels any statement running longer than this.
  statement_timeout: config.DATABASE_STATEMENT_TIMEOUT_MS,
  // Client side safety net in case the network, not the query, is what hangs.
  query_timeout: config.DATABASE_STATEMENT_TIMEOUT_MS + 1_000,
  application_name: 'everest-textile-api',
});

pool.on('error', (error) => console.error('Unexpected idle database client error', error));

// ---------------------------------------------------------------------------------------------
// Tenant context
// Each organisation's data lives in its own schema (tenant_<code>). The schema of the current
// request is held in AsyncLocalStorage and applied as the connection's search_path, so service
// code keeps writing plain `SELECT ... FROM orders` and always reads the right organisation.
// Outside a tenant context the search_path has no tenant tables at all: a query that forgot its
// context fails loudly instead of touching another organisation's data.
// ---------------------------------------------------------------------------------------------
const tenantContext = new AsyncLocalStorage();
const TENANT_SCHEMA_PATTERN = /^tenant_[a-z0-9_]+$/;
const PLATFORM_SEARCH_PATH = 'public';

/** Run `work` with every query inside it scoped to one organisation's schema. */
export function runInTenantSchema(schemaName, work) {
  if (!TENANT_SCHEMA_PATTERN.test(schemaName)) throw new Error(`Invalid tenant schema name: ${schemaName}`);
  return tenantContext.run({ schemaName }, work);
}

/** The schema of the organisation the current request belongs to, or null on platform routes. */
export function currentTenantSchema() {
  return tenantContext.getStore()?.schemaName ?? null;
}

function searchPathForCurrentContext() {
  const schemaName = currentTenantSchema();
  // Schema names are validated against TENANT_SCHEMA_PATTERN, so quoting them here is safe.
  return schemaName ? `"${schemaName}", public` : PLATFORM_SEARCH_PATH;
}

/** Point a pooled connection at the current tenant. Skips the round trip when it already is. */
async function prepareClient(client) {
  const searchPath = searchPathForCurrentContext();
  if (client.activeSearchPath !== searchPath) {
    await client.query(`SET search_path TO ${searchPath}`);
    client.activeSearchPath = searchPath;
  }
}

/** Server errors (constraint violations, timeouts) leave the connection healthy; anything else does not. */
const releaseClient = (client, error) => client.release(error && !error.code ? error : undefined);

/** Run a single parameterised query. Never interpolate user input into `text`. */
export async function query(text, params = []) {
  const client = await pool.connect();
  let failure;
  try {
    await prepareClient(client);
    return await client.query(text, params);
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    releaseClient(client, failure);
  }
}

/**
 * Run `work(client)` inside a transaction. Commits on success, rolls back on any error.
 * Every multi-step write (stock + ledger, dispatch + invoice ...) goes through here.
 */
export async function withTransaction(work) {
  const client = await pool.connect();
  let failure;
  try {
    await prepareClient(client);
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    failure = error;
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    releaseClient(client, failure);
  }
}
