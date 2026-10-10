// Migration runner shared by the CLI (migrate.js) and organisation sign-up.
//   migrations/platform/*.sql  run once per database
//   migrations/tenant/*.sql    run once per organisation, inside its own schema
// Each set records what it applied in a schema_migrations table next to the tables it created.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationsRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
const sqlCache = new Map();

async function loadMigrations(kind) {
  if (!sqlCache.has(kind)) {
    const directory = path.join(migrationsRoot, kind);
    const fileNames = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
    const files = await Promise.all(
      fileNames.map(async (fileName) => ({ fileName, sql: await readFile(path.join(directory, fileName), 'utf8') })),
    );
    sqlCache.set(kind, files);
  }
  return sqlCache.get(kind);
}

/**
 * Apply pending migrations of one kind. Must be called inside a transaction whose search_path
 * already points at `schemaName`, so each organisation's tables land in its own schema.
 */
async function applyPending(client, kind, schemaName) {
  await client.query(`CREATE TABLE IF NOT EXISTS "${schemaName}".schema_migrations (
    file_name  text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const { rows } = await client.query(`SELECT file_name FROM "${schemaName}".schema_migrations`);
  const alreadyApplied = new Set(rows.map((row) => row.file_name));
  const applied = [];
  for (const { fileName, sql } of await loadMigrations(kind)) {
    if (alreadyApplied.has(fileName)) continue;
    try {
      await client.query(sql);
    } catch (error) {
      throw new Error(`Migration ${kind}/${fileName} failed in ${schemaName}: ${error.message}`);
    }
    await client.query(`INSERT INTO "${schemaName}".schema_migrations (file_name) VALUES ($1)`, [fileName]);
    applied.push(fileName);
  }
  return applied;
}

export async function applyPlatformMigrations(client) {
  await client.query('CREATE SCHEMA IF NOT EXISTS platform');
  await client.query('SET LOCAL search_path TO platform, public');
  return applyPending(client, 'platform', 'platform');
}

/** Create (if needed) and migrate one organisation's schema. Call inside a transaction. */
export async function applyTenantMigrations(client, schemaName) {
  if (!/^tenant_[a-z0-9_]+$/.test(schemaName)) throw new Error(`Invalid tenant schema name: ${schemaName}`);
  await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
  await client.query(`SET LOCAL search_path TO "${schemaName}", public`);
  return applyPending(client, 'tenant', schemaName);
}
