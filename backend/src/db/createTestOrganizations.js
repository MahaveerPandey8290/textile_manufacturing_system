// CLI: fill a development database with test organisations for load and permission testing.
//   npm run test:orgs                      400 organisations (the default)
//   npm run test:orgs -- --count 50        a different number
//   npm run test:orgs -- --remove          delete every test organisation again
//
// Each organisation is registered exactly as the sign-up screen does it (own schema, owner, shifts),
// then gets one supplier, one buyer company and an activated account for every role:
// production manager, store manager, quality inspector, accountant and buyer.
// Nothing else is added, so the walkthrough from "Step 3. Store sets up the yarn" runs on any of them.
//
// Test organisations use the reserved .test email domain, so they are easy to find and remove and
// can never collide with a real mill. Logins are written to test-organizations.csv.
// This never runs on its own: the app itself still starts from an empty database.
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import bcrypt from 'bcryptjs';
import { pool, query, withTransaction } from './pool.js';
import { registerOrganization } from '../modules/organizations/organizations.service.js';

const TEST_DOMAIN_SUFFIX = '.test';
const CSV_PATH = 'test-organizations.csv';
const PARALLEL = 6;

const { values } = parseArgs({
  options: {
    count: { type: 'string', default: '400' },
    password: { type: 'string' },
    remove: { type: 'boolean', default: false },
  },
});

const MILL_NAMES = [
  'Shree Ganesh', 'Rajpurohit', 'Mehta', 'Vardhman', 'Mahalaxmi', 'Saraswati', 'Om Sai', 'Balaji', 'Kaveri', 'Narmada',
  'Annapurna', 'Shiv Shakti', 'Siddhivinayak', 'Kohinoor', 'Raghuvir', 'Sagar', 'Laxmi Narayan', 'Bhagwati', 'Umiya', 'Jai Ambe',
  'Krishna', 'Gokul', 'Vrindavan', 'Shubh Labh', 'Navkar', 'Mangalam', 'Sanghi', 'Rathi', 'Bansal', 'Agarwal',
  'Jindal', 'Oswal', 'Garg', 'Poddar', 'Khaitan', 'Somani', 'Kothari', 'Bhandari', 'Lodha', 'Daga',
];
const MILL_KINDS = [
  'Textiles', 'Weaving Mills', 'Spinning Mills', 'Fabrics', 'Dyeing & Printing', 'Silk Mills', 'Cotton Mills', 'Denim Mills',
  'Processors', 'Synthetics',
];
const CITIES = [
  'Surat', 'Bhilwara', 'Ludhiana', 'Tiruppur', 'Coimbatore', 'Panipat', 'Erode', 'Ichalkaranji', 'Bhiwandi', 'Ahmedabad',
  'Jodhpur', 'Kanpur', 'Salem', 'Malegaon', 'Varanasi', 'Pali', 'Karur', 'Amritsar', 'Indore', 'Madurai',
];
const FIRST_NAMES = [
  'Ramesh', 'Prakash', 'Sunil', 'Kavita', 'Anil', 'Rakesh', 'Meena', 'Vikram', 'Pooja', 'Suresh', 'Deepak', 'Anjali',
  'Mahesh', 'Neha', 'Ajay', 'Sunita', 'Manoj', 'Priya', 'Rajesh', 'Geeta', 'Arjun', 'Lata', 'Naveen', 'Rekha',
];
const LAST_NAMES = ['Sharma', 'Jain', 'Choudhary', 'Bishnoi', 'Mehta', 'Patel', 'Agarwal', 'Iyer', 'Reddy', 'Singh', 'Gupta', 'Nair', 'Desai', 'Rathore'];
const BUYER_NAMES = ['Garments', 'Apparels', 'Fashions', 'Exports', 'Clothing Co.', 'Retail', 'Uniforms', 'Home Furnishings'];
const SUPPLIER_NAMES = ['Spinners', 'Yarns', 'Fibres', 'Polyfab', 'Cotspin'];
const STAFF_ROLES = [
  ['PRODUCTION_MANAGER', 'production'],
  ['STORE_MANAGER', 'store'],
  ['QUALITY_INSPECTOR', 'quality'],
  ['ACCOUNTANT', 'accounts'],
];

const pick = (list, index, step = 1) => list[(index * step) % list.length];
const personName = (index, offset) => `${pick(FIRST_NAMES, index + offset, 7)} ${pick(LAST_NAMES, index + offset, 5)}`;
const slugOf = (text) => text.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function describeMill(index) {
  // 40 names x 10 kinds: the first 400 organisations all get different names.
  const name = `${pick(MILL_NAMES, index)} ${pick(MILL_KINDS, index + Math.floor(index / MILL_NAMES.length))}`;
  const number = String(index + 1).padStart(3, '0');
  return {
    name,
    city: pick(CITIES, index, 7),
    domain: `${slugOf(pick(MILL_NAMES, index))}-${number}${TEST_DOMAIN_SUFFIX}`,
    buyerDomain: `${slugOf(pick(MILL_NAMES, index + 11))}-buyer-${number}${TEST_DOMAIN_SUFFIX}`,
    phone: `+91 98${String(10_000_000 + index * 7919).slice(-8)}`,
  };
}

async function createOne(index, password, passwordHash) {
  const mill = describeMill(index);
  const owner = { fullName: personName(index, 0), email: `owner@${mill.domain}`, password };
  const { organizationCode, schemaName } = await registerOrganization(
    { organization: { name: mill.name, city: mill.city, phone: mill.phone }, owner },
    { ip: '127.0.0.1' },
  );

  const logins = [{ role: 'OWNER', name: owner.fullName, email: owner.email }];
  await withTransaction(async (client) => {
    const schema = `"${schemaName}"`;
    await client.query(
      `INSERT INTO ${schema}.suppliers (company_name, contact_person, phone, email, address) VALUES ($1, $2, $3, $4, $5)`,
      [`${pick(MILL_NAMES, index + 5)} ${pick(SUPPLIER_NAMES, index)}`, personName(index, 9), '+91 94140 55501', `sales@supplier-${index + 1}${TEST_DOMAIN_SUFFIX}`, `${pick(CITIES, index + 3)}`],
    );
    const buyerCompany = `${pick(MILL_NAMES, index + 11)} ${pick(BUYER_NAMES, index)}`;
    const { rows } = await client.query(
      `INSERT INTO ${schema}.buyers (company_name, contact_person, phone, email, address) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [buyerCompany, personName(index, 5), '+91 98250 33210', `purchase@${mill.buyerDomain}`, pick(CITIES, index + 9)],
    );
    for (const [offset, [role, mailbox]] of STAFF_ROLES.entries()) {
      const user = { role, name: personName(index, offset + 1), email: `${mailbox}@${mill.domain}` };
      await client.query(
        `INSERT INTO ${schema}.users (full_name, email, password_hash, role, activated_at) VALUES ($1, $2, $3, $4, now())`,
        [user.name, user.email, passwordHash, role],
      );
      logins.push(user);
    }
    const buyer = { role: 'BUYER', name: personName(index, 5), email: `buyer@${mill.buyerDomain}` };
    await client.query(
      `INSERT INTO ${schema}.users (full_name, email, password_hash, role, buyer_id, activated_at) VALUES ($1, $2, $3, 'BUYER', $4, now())`,
      [buyer.name, buyer.email, passwordHash, rows[0].id],
    );
    logins.push({ ...buyer, name: `${buyer.name} (${buyerCompany})` });
  });
  return logins.map((login) => ({ ...login, organizationCode, organizationName: mill.name }));
}

async function removeTestOrganizations() {
  const { rows } = await query(`SELECT id, schema_name FROM platform.organizations WHERE email_domain LIKE $1`, [`%${TEST_DOMAIN_SUFFIX}`]);
  for (const organization of rows) {
    await withTransaction(async (client) => {
      await client.query(`DROP SCHEMA IF EXISTS "${organization.schema_name}" CASCADE`);
      await client.query('DELETE FROM platform.organizations WHERE id = $1', [organization.id]);
    });
  }
  console.log(`Removed ${rows.length} test organisation(s).`);
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Test organisations are for development databases only.');
  if (values.remove) return removeTestOrganizations();

  const count = Number(values.count);
  if (!Number.isInteger(count) || count < 1 || count > 2000) throw new Error('Pass --count between 1 and 2000.');
  const password = values.password ?? process.env.TEST_ORG_PASSWORD ?? 'Testmill2026';
  if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error('The password needs at least 10 characters, a letter and a number.');
  }
  const { rows } = await query(`SELECT count(*)::int AS existing FROM platform.organizations WHERE email_domain LIKE $1`, [`%${TEST_DOMAIN_SUFFIX}`]);
  const start = rows[0].existing;
  const passwordHash = await bcrypt.hash(password, 10);

  const logins = [];
  const startedAt = Date.now();
  for (let batchStart = 0; batchStart < count; batchStart += PARALLEL) {
    const batch = Array.from({ length: Math.min(PARALLEL, count - batchStart) }, (_, offset) => start + batchStart + offset);
    const results = await Promise.all(batch.map((index) => createOne(index, password, passwordHash)));
    results.forEach((result) => logins.push(...result));
    const done = batchStart + batch.length;
    if (done % 50 === 0 || done === count) console.log(`  ${done}/${count} organisations`);
  }

  const csv = ['organisation_code,organisation_name,role,name,email,password']
    .concat(logins.map((login) => [login.organizationCode, login.organizationName, login.role, login.name, login.email, password].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')))
    .join('\n');
  writeFileSync(CSV_PATH, `${csv}\n`);
  console.log(`Created ${count} organisations with ${logins.length} logins in ${Math.round((Date.now() - startedAt) / 1000)} s.`);
  console.log(`Every account uses the password "${password}". Logins are in backend/${CSV_PATH}.`);
  console.log('Owners sign in under "Sign in as organisation"; everyone else uses "Sign in as staff" with their code.');
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
