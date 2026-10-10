import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveOrderStatus } from '../src/modules/orders/orderStatus.js';

const baseOrder = { currentStatus: 'NEW', quantityMeters: 1000, producedMeters: 0, passedMeters: 0, dispatchedMeters: 0, activeJobCount: 0, jobCount: 0 };

test('a fresh order is NEW', () => {
  assert.equal(deriveOrderStatus(baseOrder), 'NEW');
});

test('planning a job moves the order into production', () => {
  assert.equal(deriveOrderStatus({ ...baseOrder, jobCount: 1, activeJobCount: 1 }), 'IN_PRODUCTION');
});

test('fully woven with no active jobs waits for quality check', () => {
  assert.equal(deriveOrderStatus({ ...baseOrder, jobCount: 2, producedMeters: 1000 }), 'QUALITY_CHECK');
});

test('passed meters within the 3% tolerance make it ready to ship', () => {
  assert.equal(deriveOrderStatus({ ...baseOrder, jobCount: 2, producedMeters: 980, passedMeters: 975 }), 'READY_TO_DISPATCH');
  assert.equal(deriveOrderStatus({ ...baseOrder, jobCount: 2, producedMeters: 980, passedMeters: 960, activeJobCount: 0 }), 'QUALITY_CHECK');
});

test('dispatch progress wins over everything else', () => {
  assert.equal(deriveOrderStatus({ ...baseOrder, passedMeters: 1000, dispatchedMeters: 400 }), 'PARTIALLY_DISPATCHED');
  assert.equal(deriveOrderStatus({ ...baseOrder, passedMeters: 1000, dispatchedMeters: 1000 }), 'DISPATCHED');
});

test('cancelled orders stay cancelled', () => {
  assert.equal(deriveOrderStatus({ ...baseOrder, currentStatus: 'CANCELLED', passedMeters: 1000 }), 'CANCELLED');
});
