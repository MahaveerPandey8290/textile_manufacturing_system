import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { pool, query } from '../src/db/pool.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

after(() => pool.end());

test('PostgreSQL cancels statements that run past statement_timeout', async () => {
  const { rows } = await query('SHOW statement_timeout');
  assert.notEqual(rows[0].statement_timeout, '0', 'pool must set a statement timeout');
  await assert.rejects(query("SELECT pg_sleep(30)"), (error) => error.code === '57014');
});

test('a cancelled query becomes a friendly 504 for the user', () => {
  let sentStatus;
  let sentBody;
  const response = { status: (code) => ((sentStatus = code), response), json: (body) => (sentBody = body) };
  errorHandler(Object.assign(new Error('canceling statement due to statement timeout'), { code: '57014' }), { method: 'GET', originalUrl: '/x' }, response);
  assert.equal(sentStatus, 504);
  assert.match(sentBody.error.message, /took too long/);
});
