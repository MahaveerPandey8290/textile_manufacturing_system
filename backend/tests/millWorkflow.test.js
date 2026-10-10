// End-to-end API test over a freshly seeded test database (see `npm test`).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool, query, runInTenantSchema } from '../src/db/pool.js';

const app = createApp();
const PASSWORD = 'Mill@12345';
const ORGANIZATION_CODE = 'EVE-K7M2Q';
const agents = {};
// Direct database checks read the demo mill's own schema.
const tenantQuery = (sql, params) => runInTenantSchema('tenant_eve_k7m2q', () => query(sql, params));

const ROLE_BY_AGENT = { production: 'PRODUCTION_MANAGER', store: 'STORE_MANAGER', quality: 'QUALITY_INSPECTOR', accounts: 'ACCOUNTANT', buyer: 'BUYER' };

async function signIn(role, email) {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/login').send({ organizationCode: ORGANIZATION_CODE, role: ROLE_BY_AGENT[role], email, password: PASSWORD });
  assert.equal(response.status, 200, `login failed for ${email}`);
  agents[role] = agent;
}

before(async () => {
  await signIn('production', 'production@everestmills.in');
  await signIn('store', 'store@everestmills.in');
  await signIn('quality', 'quality@everestmills.in');
  await signIn('accounts', 'accounts@everestmills.in');
  await signIn('buyer', 'buyer@raymondapparel.example');
});
after(() => pool.end());

describe('security', () => {
  test('rejects requests without a session', async () => {
    const response = await request(app).get('/api/orders');
    assert.equal(response.status, 401);
  });

  test('rejects a wrong password with a generic message', async () => {
    const response = await request(app).post('/api/auth/login').send({ organizationCode: ORGANIZATION_CODE, role: 'OWNER', email: 'owner@everestmills.in', password: 'wrong-password' });
    assert.equal(response.status, 401);
    assert.equal(response.body.error.message, 'Role, email or password is incorrect.');
  });

  test('a buyer cannot read another buyer\'s order or internal costing', async () => {
    const { rows } = await tenantQuery(`SELECT o.id, o.buyer_id, u.buyer_id AS own_buyer_id FROM orders o, users u WHERE u.email = 'buyer@raymondapparel.example'`);
    const foreignOrder = rows.find((row) => row.buyer_id !== row.own_buyer_id);
    const ownOrder = rows.find((row) => row.buyer_id === row.own_buyer_id);
    assert.equal((await agents.buyer.get(`/api/orders/${foreignOrder.id}`)).status, 404);
    const own = await agents.buyer.get(`/api/orders/${ownOrder.id}`);
    assert.equal(own.status, 200);
    assert.equal(own.body.total_cost, undefined);
    assert.equal(own.body.timeline[0].changed_by_name, undefined);
  });

  test('role checks block staff from areas outside their job', async () => {
    assert.equal((await agents.quality.get('/api/finance/invoices')).status, 403);
    assert.equal((await agents.buyer.get('/api/inventory/yarn-types')).status, 403);
  });

  test('validation errors name the field', async () => {
    const response = await agents.production.post('/api/orders').send({ buyerId: 1, colour: 'x' });
    assert.equal(response.status, 400);
    assert.ok(response.body.error.details.some((detail) => detail.field === 'fabricTypeId'));
  });
});

describe('a day at the mill', () => {
  const state = {};

  test('office creates an order and checks yarn', async () => {
    const fabric = (await agents.production.get('/api/inventory/fabric-types')).body[0];
    state.fabric = fabric;
    const created = await agents.production.post('/api/orders').send({
      buyerId: 1, fabricTypeId: fabric.id, colour: 'Test Teal', quantityMeters: 200, ratePerMeter: 150, dueDate: '2030-01-15',
    });
    assert.equal(created.status, 201);
    assert.match(created.body.order_number, /^ORD-\d{4}-\d{5}$/);
    state.order = created.body;
    const availability = await agents.production.get('/api/inventory/availability').query({ fabricTypeId: fabric.id, quantityMeters: 200 });
    assert.equal(availability.body.requiredKg, Math.round(200 * fabric.yarn_kg_per_meter * 100) / 100);
  });

  test('store issues yarn and stock goes down by exactly that much', async () => {
    const before = (await tenantQuery('SELECT current_stock_kg FROM yarn_types WHERE id = $1', [state.fabric.yarn_type_id])).rows[0].current_stock_kg;
    const response = await agents.store.post('/api/inventory/issues').send({ orderId: state.order.id, yarnTypeId: state.fabric.yarn_type_id, quantityKg: 25 });
    assert.equal(response.status, 201);
    const afterIssue = (await tenantQuery('SELECT current_stock_kg FROM yarn_types WHERE id = $1', [state.fabric.yarn_type_id])).rows[0].current_stock_kg;
    assert.equal(Math.round((before - afterIssue) * 100) / 100, 25);
  });

  test('cannot issue more yarn than is in stock', async () => {
    const response = await agents.store.post('/api/inventory/issues').send({ orderId: state.order.id, yarnTypeId: state.fabric.yarn_type_id, quantityKg: 999_999 });
    assert.equal(response.status, 409);
  });

  test('floor plans, starts and logs a weaving job', async () => {
    const machine = (await agents.production.get('/api/production/machines')).body.machines.find((candidate) => candidate.stage === 'WEAVING' && candidate.status === 'IDLE');
    assert.ok(machine, 'needs an idle loom in the seed data');
    const job = await agents.production.post('/api/production/jobs').send({ orderId: state.order.id, stage: 'WEAVING', machineId: machine.id, plannedQuantity: 200 });
    assert.equal(job.status, 201);
    assert.equal((await agents.production.post(`/api/production/jobs/${job.body.id}/start`).send({})).status, 200);
    const log = await agents.production.post('/api/production/logs').send({ productionJobId: job.body.id, quantityProduced: 210, hoursWorked: 6 });
    assert.equal(log.status, 201);
    assert.equal(log.body.machine_cost, Math.round(machine.hourly_running_cost * 6 * 100) / 100);
    assert.equal((await agents.production.post(`/api/production/jobs/${job.body.id}/complete`).send({})).status, 200);
    state.job = job.body;
    state.machine = machine;
  });

  test('rolls are created, inspected and the order becomes ready to ship', async () => {
    state.rolls = [];
    for (const length of [105, 104]) {
      const roll = await agents.production.post('/api/quality/rolls').send({ orderId: state.order.id, machineId: state.machine.id, productionJobId: state.job.id, lengthMeters: length });
      assert.equal(roll.status, 201);
      state.rolls.push(roll.body);
    }
    for (const roll of state.rolls) {
      const inspection = await agents.quality.post('/api/quality/inspections').send({ fabricRollId: roll.id, result: 'PASS', grade: 'A' });
      assert.equal(inspection.status, 201);
    }
    const order = await agents.production.get(`/api/orders/${state.order.id}`);
    assert.equal(order.body.status, 'READY_TO_DISPATCH');
  });

  test('quality can register rolls too, the store cannot', async () => {
    const incomplete = { orderId: state.order.id, machineId: state.machine.id };
    assert.equal((await agents.quality.post('/api/quality/rolls').send(incomplete)).status, 400, 'allowed, so only validation fails');
    assert.equal((await agents.store.post('/api/quality/rolls').send(incomplete)).status, 403);
  });

  test('dispatch raises a matching invoice and a roll can never go out twice', async () => {
    const rollIds = state.rolls.map((roll) => roll.id);
    const [first, second] = await Promise.all([
      agents.store.post('/api/dispatches').send({ orderId: state.order.id, rollIds, vehicleNumber: 'MH 04 TT 1111' }),
      agents.store.post('/api/dispatches').send({ orderId: state.order.id, rollIds, vehicleNumber: 'MH 04 TT 2222' }),
    ]);
    const statuses = [first.status, second.status].sort();
    assert.deepEqual(statuses, [201, 409], 'exactly one of two simultaneous dispatches may succeed');
    const winner = first.status === 201 ? first.body : second.body;
    assert.equal(winner.total_meters, 209);
    assert.equal(winner.invoice.subtotal, 209 * 150);
    assert.equal(winner.invoice.total_amount, Math.round(209 * 150 * 1.05 * 100) / 100);
    state.invoice = winner.invoice;
    const order = await agents.production.get(`/api/orders/${state.order.id}`);
    assert.equal(order.body.status, 'DISPATCHED');
  });

  test('accounts records payment; overpayment is refused', async () => {
    const tooMuch = await agents.accounts.post('/api/finance/buyer-payments').send({ invoiceId: state.invoice.id, amount: state.invoice.total_amount + 1, method: 'UPI' });
    assert.equal(tooMuch.status, 409);
    const paid = await agents.accounts.post('/api/finance/buyer-payments').send({ invoiceId: state.invoice.id, amount: state.invoice.total_amount, method: 'UPI' });
    assert.equal(paid.status, 201);
    assert.equal(paid.body.status, 'PAID');
  });

  test('the public tracking link works without a login and hides internals', async () => {
    const response = await request(app).get(`/api/public/track/${ORGANIZATION_CODE}/${state.order.tracking_token}`);
    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'DISPATCHED');
    assert.equal(response.body.id, undefined);
    assert.equal(response.body.rate_per_meter, undefined);
  });
});

describe('search', () => {
  test('global search is case-insensitive and treats % literally', async () => {
    const response = await agents.production.get('/api/search').query({ q: 'raym' });
    assert.equal(response.status, 200);
    assert.ok(response.body.some((result) => result.kind === 'buyer'));
    const wildcard = await agents.production.get('/api/search').query({ q: '%%' });
    assert.equal(wildcard.body.length, 0);
  });
});
