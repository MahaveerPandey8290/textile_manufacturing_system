// CLI: bring the platform schema and every organisation's schema up to date.
//   npm run db:migrate             apply pending migrations
//   npm run db:reset               drop everything first, leaving an empty database (development only)
import { pool } from './pool.js';
import { applyPlatformMigrations, applyTenantMigrations } from './migrations.js';

const shouldReset = process.argv.includes('--reset');

async function inTransaction(client, work) {
  await client.query('BEGIN');
  try {
    const result = await work();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function runMigrations() {
  const client = await pool.connect();
  try {
    if (shouldReset) {
      if (process.env.NODE_ENV === 'production') throw new Error('Refusing to reset a production database.');
      console.log('Resetting database: dropping platform, tenant_* and public schemas ...');
      const { rows } = await client.query(`SELECT nspname FROM pg_namespace WHERE nspname = 'platform' OR nspname LIKE 'tenant\\_%'`);
      for (const { nspname } of rows) await client.query(`DROP SCHEMA "${nspname}" CASCADE`);
      await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    }

    const platformApplied = await inTransaction(client, () => applyPlatformMigrations(client));
    for (const fileName of platformApplied) console.log(`Applied platform/${fileName}`);

    const { rows: organizations } = await client.query('SELECT schema_name FROM platform.organizations ORDER BY id');
    for (const { schema_name: schemaName } of organizations) {
      const applied = await inTransaction(client, () => applyTenantMigrations(client, schemaName));
      for (const fileName of applied) console.log(`Applied tenant/${fileName} to ${schemaName}`);
    }
    console.log(`Database is up to date (${organizations.length} organisation schema(s)).`);
    const { rows: admins } = await client.query('SELECT count(*)::int AS count FROM platform.platform_admins');
    if (!admins[0].count) console.log('No super admin yet. Create one with: npm run platform:admin -- --email you@yourcompany.com --name "Your Name"');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
