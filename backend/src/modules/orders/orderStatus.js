// Order status is derived from what actually happened on the floor, never typed in by hand.
// Any module that changes jobs, rolls or dispatches calls refreshOrderStatus() inside its transaction.

// Fabric contracts usually accept a small shortfall against the ordered length.
export const QUANTITY_TOLERANCE_PERCENT = 3;

export function deriveOrderStatus({ currentStatus, quantityMeters, producedMeters, passedMeters, dispatchedMeters, activeJobCount, jobCount }) {
  if (currentStatus === 'CANCELLED') return 'CANCELLED';
  const acceptableMeters = quantityMeters * (1 - QUANTITY_TOLERANCE_PERCENT / 100);
  if (dispatchedMeters >= acceptableMeters) return 'DISPATCHED';
  if (dispatchedMeters > 0) return 'PARTIALLY_DISPATCHED';
  if (passedMeters >= acceptableMeters) return 'READY_TO_DISPATCH';
  if (producedMeters >= acceptableMeters && activeJobCount === 0) return 'QUALITY_CHECK';
  if (jobCount > 0 || producedMeters > 0) return 'IN_PRODUCTION';
  return 'NEW';
}

export async function refreshOrderStatus(client, orderId, { userId = null, note = null } = {}) {
  const { rows } = await client.query(
    `SELECT o.status AS current_status, o.quantity_meters, p.produced_meters, p.passed_meters, p.dispatched_meters,
            (SELECT count(*) FROM production_jobs j WHERE j.order_id = o.id AND j.status IN ('IN_PROGRESS', 'ON_HOLD', 'PLANNED')) AS active_job_count,
            (SELECT count(*) FROM production_jobs j WHERE j.order_id = o.id) AS job_count
       FROM orders o JOIN order_progress p ON p.order_id = o.id
      WHERE o.id = $1
      FOR UPDATE OF o`,
    [orderId],
  );
  const snapshot = rows[0];
  if (!snapshot) return null;

  const nextStatus = deriveOrderStatus({
    currentStatus: snapshot.current_status,
    quantityMeters: snapshot.quantity_meters,
    producedMeters: snapshot.produced_meters,
    passedMeters: snapshot.passed_meters,
    dispatchedMeters: snapshot.dispatched_meters,
    activeJobCount: snapshot.active_job_count,
    jobCount: snapshot.job_count,
  });
  if (nextStatus !== snapshot.current_status) {
    await client.query('UPDATE orders SET status = $2 WHERE id = $1', [orderId, nextStatus]);
    await client.query(
      'INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by) VALUES ($1, $2, $3, $4, $5)',
      [orderId, snapshot.current_status, nextStatus, note, userId],
    );
  }
  return nextStatus;
}
