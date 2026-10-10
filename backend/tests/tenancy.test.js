// Multi-tenancy: organisation sign-up, isolation between organisations, staff invitations,
// one-time codes, suspension, and the boundary between platform admins and organisations.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool, query } from '../src/db/pool.js';
import { testOutbox } from '../src/utils/mailer.js';

const app = createApp();
const PASSWORD = 'Mill@12345';
const NEW_OWNER_PASSWORD = 'Loom2026start';
const state = {};

const signUpBody = (overrides = {}) => ({
  organization: { name: 'Tapti Cotton Mills', city: 'Surat', phone: '', gstNumber: '', ...overrides.organization },
  owner: { fullName: 'Meera Shah', email: 'meera@taptimills.in', password: NEW_OWNER_PASSWORD, confirmPassword: NEW_OWNER_PASSWORD, ...overrides.owner },
});

function latestCodeFor(email) {
  const message = [...testOutbox].reverse().find((mail) => mail.to === email);
  return message?.text.match(/^\s+(\d{6})$/m)?.[1];
}

before(async () => {
  state.platform = request.agent(app);
  const response = await state.platform.post('/api/auth/platform/login').send({ email: 'admin@millos.in', password: PASSWORD });
  assert.equal(response.status, 200);
});
after(() => pool.end());

describe('organisation sign-up', () => {
  test('refuses personal email addresses and names every problem', async () => {
    const response = await request(app)
      .post('/api/auth/organizations')
      .send(signUpBody({ owner: { email: 'meera@gmail.com', confirmPassword: 'different1' } }));
    assert.equal(response.status, 400);
    const fields = response.body.error.details.map((detail) => detail.field);
    assert.ok(fields.includes('owner.email'));
    assert.ok(fields.includes('owner.confirmPassword'));
  });

  test('creates the organisation, its own schema and a signed-in owner', async () => {
    state.owner = request.agent(app);
    const response = await state.owner.post('/api/auth/organizations').send(signUpBody());
    assert.equal(response.status, 201);
    assert.match(response.body.organizationCode, /^TAP-[A-Z2-9]{5}$/);
    assert.equal(response.body.session.organization.name, 'Tapti Cotton Mills');
    state.code = response.body.organizationCode;

    const { rows } = await query('SELECT schema_name, email_domain FROM platform.organizations WHERE organization_code = $1', [state.code]);
    assert.equal(rows[0].email_domain, 'taptimills.in');
    const schema = await query('SELECT 1 FROM pg_namespace WHERE nspname = $1', [rows[0].schema_name]);
    assert.equal(schema.rowCount, 1);

    const me = await state.owner.get('/api/auth/me');
    assert.equal(me.body.user.role, 'OWNER');
  });

  test('branding by code is public and reveals nothing internal', async () => {
    const response = await request(app).get(`/api/public/organizations/${state.code.toLowerCase()}`);
    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(response.body).sort(), ['city', 'code', 'emailDomain', 'logoUrl', 'name']);
  });
});

describe('organisation admin sign-in ("Welcome back")', () => {
  test('the owner signs in with just their work email and password', async () => {
    const agent = request.agent(app);
    const response = await agent.post('/api/auth/organization/login').send({ email: 'Meera@TaptiMills.in', password: NEW_OWNER_PASSWORD });
    assert.equal(response.status, 200);
    assert.equal(response.body.organization.code, state.code);
    assert.equal(response.body.organization.name, 'Tapti Cotton Mills');
    assert.equal(response.body.user.role, 'OWNER');
    assert.equal((await agent.get('/api/orders')).status, 200);
  });

  test('wrong passwords, unknown emails and staff accounts get the same refusal', async () => {
    const wrongPassword = await request(app).post('/api/auth/organization/login').send({ email: 'meera@taptimills.in', password: 'not-it-123' });
    const unknown = await request(app).post('/api/auth/organization/login').send({ email: 'nobody@nowhere-mills.in', password: 'not-it-123' });
    const staff = await request(app).post('/api/auth/organization/login').send({ email: 'store@everestmills.in', password: PASSWORD });
    for (const response of [wrongPassword, unknown, staff]) {
      assert.equal(response.status, 401);
      assert.match(response.body.error.message, /Email or password is incorrect/);
    }
  });

  test('the Everest owner lands in Everest, not in another organisation', async () => {
    const response = await request(app).post('/api/auth/organization/login').send({ email: 'owner@everestmills.in', password: PASSWORD });
    assert.equal(response.status, 200);
    assert.equal(response.body.organization.code, 'EVE-K7M2Q');
  });

  test('an owner can reset their password without the organisation code', async () => {
    const requested = await request(app).post('/api/auth/password/request-code').send({ email: 'owner@ganeshspinners.in' });
    assert.equal(requested.status, 200);
    const code = latestCodeFor('owner@ganeshspinners.in');
    assert.match(code, /^\d{6}$/);
    const verified = await request(app).post('/api/auth/password/verify-code').send({ email: 'owner@ganeshspinners.in', code });
    assert.equal(verified.status, 200);
    const newPassword = 'Spindle2026x';
    const reset = await request(app).post('/api/auth/password/reset').send({ resetToken: verified.body.resetToken, newPassword, confirmPassword: newPassword });
    assert.equal(reset.status, 200);
    assert.equal(reset.body.organization.code, 'SHR-4HT8P');
    const signedIn = await request(app).post('/api/auth/organization/login').send({ email: 'owner@ganeshspinners.in', password: newPassword });
    assert.equal(signedIn.status, 200);
  });

  test('without a code, only owners can request one (staff use their organisation code)', async () => {
    const before = testOutbox.length;
    const response = await request(app).post('/api/auth/password/request-code').send({ email: 'floor@ganeshspinners.in' });
    assert.equal(response.status, 200);
    assert.equal(testOutbox.length, before);
  });
});

describe('isolation between organisations', () => {
  test('a new organisation sees none of the demo mill\'s data', async () => {
    const orders = await state.owner.get('/api/orders');
    assert.equal(orders.body.totalCount, 0);
    // Order 1 exists in Everest's schema, but not in this organisation's.
    assert.equal((await state.owner.get('/api/orders/1')).status, 404);
    const search = await state.owner.get('/api/search').query({ q: 'raym' });
    assert.ok(Object.values(search.body).every((group) => !Array.isArray(group) || group.length === 0));
  });

  test('an organisation code only signs people into that organisation', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ organizationCode: state.code, role: 'OWNER', email: 'owner@everestmills.in', password: PASSWORD });
    assert.equal(response.status, 401);
  });

  test('queries outside any organisation cannot see tenant tables at all', async () => {
    await assert.rejects(query('SELECT count(*) FROM orders'), (error) => error.code === '42P01');
  });
});

describe('staff invitation and first-time setup', () => {
  test('staff must be invited with the organisation\'s own email domain', async () => {
    const wrongDomain = await state.owner.post('/api/users').send({ fullName: 'Arjun Rao', email: 'arjun@elsewhere.in', role: 'STORE_MANAGER' });
    assert.equal(wrongDomain.status, 400);
    const invited = await state.owner.post('/api/users').send({ fullName: 'Arjun Rao', email: 'arjun@taptimills.in', role: 'STORE_MANAGER' });
    assert.equal(invited.status, 201);
    assert.ok(testOutbox.some((mail) => mail.to === 'arjun@taptimills.in' && mail.text.includes(state.code)));
  });

  test('an invited person cannot sign in before setting a password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ organizationCode: state.code, role: 'STORE_MANAGER', email: 'arjun@taptimills.in', password: 'anything-1234' });
    assert.equal(response.status, 401);
  });

  test('unknown emails get the same answer and no email is sent', async () => {
    const before = testOutbox.length;
    const response = await request(app).post('/api/auth/password/request-code').send({ organizationCode: state.code, email: 'nobody@taptimills.in' });
    assert.equal(response.status, 200);
    assert.equal(testOutbox.length, before);
  });

  test('code -> verify -> new password activates the account, once', async () => {
    const requested = await request(app).post('/api/auth/password/request-code').send({ organizationCode: state.code, email: 'arjun@taptimills.in' });
    assert.equal(requested.status, 200);
    const code = latestCodeFor('arjun@taptimills.in');
    assert.match(code, /^\d{6}$/);

    const wrong = await request(app)
      .post('/api/auth/password/verify-code')
      .send({ organizationCode: state.code, email: 'arjun@taptimills.in', code: code === '000000' ? '111111' : '000000' });
    assert.equal(wrong.status, 400);

    const verified = await request(app).post('/api/auth/password/verify-code').send({ organizationCode: state.code, email: 'arjun@taptimills.in', code });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.isFirstTime, true);

    const newPassword = 'Store2026yarn';
    const reset = await request(app)
      .post('/api/auth/password/reset')
      .send({ resetToken: verified.body.resetToken, newPassword, confirmPassword: newPassword });
    assert.equal(reset.status, 200);
    assert.equal(reset.body.accountCreated, true);

    const reused = await request(app)
      .post('/api/auth/password/reset')
      .send({ resetToken: verified.body.resetToken, newPassword: 'Another2026x', confirmPassword: 'Another2026x' });
    assert.equal(reused.status, 400);

    const signedIn = await request(app)
      .post('/api/auth/login')
      .send({ organizationCode: state.code, role: 'STORE_MANAGER', email: 'arjun@taptimills.in', password: newPassword });
    assert.equal(signedIn.status, 200);
    assert.equal(signedIn.body.organization.code, state.code);
  });

  test('a code locks after five wrong guesses', async () => {
    // Allow a fresh code by moving the previous one outside the resend window.
    await query(`UPDATE "${(await query('SELECT schema_name FROM platform.organizations WHERE organization_code = $1', [state.code])).rows[0].schema_name}".password_reset_codes SET created_at = created_at - interval '2 minutes'`);
    await request(app).post('/api/auth/password/request-code').send({ organizationCode: state.code, email: 'meera@taptimills.in' });
    const code = latestCodeFor('meera@taptimills.in');
    const wrongCode = code === '999999' ? '999998' : '999999';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app).post('/api/auth/password/verify-code').send({ organizationCode: state.code, email: 'meera@taptimills.in', code: wrongCode });
    }
    const correctButLocked = await request(app).post('/api/auth/password/verify-code').send({ organizationCode: state.code, email: 'meera@taptimills.in', code });
    assert.equal(correctButLocked.status, 400);
  });
});

describe('platform console', () => {
  test('organisation sessions and platform sessions stay on their own side', async () => {
    assert.equal((await state.owner.get('/api/platform/overview')).status, 403);
    assert.equal((await state.platform.get('/api/orders')).status, 403);
    assert.equal((await request(app).get('/api/platform/overview')).status, 401);
  });

  test('the overview counts every organisation, including the new one', async () => {
    const response = await state.platform.get('/api/platform/overview');
    assert.equal(response.status, 200);
    assert.ok(response.body.organizations.total >= 5);
    assert.ok(response.body.recentEvents.some((event) => event.organization_code === state.code));
    const list = await state.platform.get('/api/platform/organizations').query({ search: 'tapti' });
    assert.equal(list.body.items.length, 1);
    assert.equal(list.body.items[0].user_count, 2);
    assert.equal(list.body.items[0].schema_name, undefined);
    state.organizationId = list.body.items[0].id;
  });

  test('suspending an organisation blocks it at once; reactivating restores it', async () => {
    const withoutReason = await state.platform.patch(`/api/platform/organizations/${state.organizationId}/status`).send({ status: 'SUSPENDED' });
    assert.equal(withoutReason.status, 400);
    const suspended = await state.platform
      .patch(`/api/platform/organizations/${state.organizationId}/status`)
      .send({ status: 'SUSPENDED', reason: 'Test suspension' });
    assert.equal(suspended.status, 200);

    assert.equal((await state.owner.get('/api/orders')).status, 403);
    assert.equal((await request(app).get(`/api/public/organizations/${state.code}`)).status, 404);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ organizationCode: state.code, role: 'OWNER', email: 'meera@taptimills.in', password: NEW_OWNER_PASSWORD });
    assert.equal(login.status, 403);

    await state.platform.patch(`/api/platform/organizations/${state.organizationId}/status`).send({ status: 'ACTIVE' });
    assert.equal((await state.owner.get('/api/orders')).status, 200);
  });
});
