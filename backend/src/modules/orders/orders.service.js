import { query, withTransaction } from '../../db/pool.js';
import { ROLES } from '../../constants/roles.js';
import { recordAudit } from '../../utils/auditLog.js';
import { nextDocumentNumber } from '../../utils/documentNumbers.js';
import { conflict, notFound } from '../../utils/httpError.js';
import { toLikePattern, toOffset, toPage } from '../../utils/pagination.js';
import { checkYarnAvailability } from '../inventory/inventory.service.js';

const isBuyer = (user) => user.role === ROLES.BUYER;

export async function listOrders(user, { search, page, pageSize, status, buyerId }) {
  // Buyers only ever see their own orders, whatever filter they send.
  const scopedBuyerId = isBuyer(user) ? user.buyerId : buyerId ?? null;
  const { rows } = await query(
    `SELECT o.id, o.order_number, o.colour, o.quantity_meters, o.rate_per_meter, o.due_date, o.priority, o.status,
            o.created_at, b.company_name AS buyer_name, f.name AS fabric_name,
            p.produced_meters, p.passed_meters, p.dispatched_meters,
            (o.due_date < CURRENT_DATE AND o.status NOT IN ('DISPATCHED', 'CANCELLED')) AS is_overdue,
            count(*) OVER () AS total_count
       FROM orders o
       JOIN buyers b ON b.id = o.buyer_id
       JOIN fabric_types f ON f.id = o.fabric_type_id
       JOIN order_progress p ON p.order_id = o.id
      WHERE ($1 = '' OR o.order_number ILIKE $2 OR b.company_name ILIKE $2 OR o.colour ILIKE $2 OR f.name ILIKE $2)
        AND ($3::order_status IS NULL OR o.status = $3)
        AND ($4::bigint IS NULL OR o.buyer_id = $4)
      ORDER BY
        CASE WHEN o.status IN ('DISPATCHED', 'CANCELLED') THEN 1 ELSE 0 END,
        o.due_date, o.id DESC
      LIMIT $5 OFFSET $6`,
    [search, toLikePattern(search), status ?? null, scopedBuyerId, pageSize, toOffset({ page, pageSize })],
  );
  return toPage(rows, { page, pageSize });
}

export async function getOrderDetail(user, orderId) {
  const { rows } = await query(
    `SELECT o.*, b.company_name AS buyer_name, b.contact_person AS buyer_contact, b.phone AS buyer_phone,
            f.name AS fabric_name, f.construction, f.gsm, f.yarn_type_id,
            p.produced_meters, p.passed_meters, p.pending_qc_meters, p.rejected_meters, p.dispatched_meters, p.roll_count,
            c.material_cost, c.labour_cost, c.machine_cost, c.total_cost,
            u.full_name AS created_by_name
       FROM orders o
       JOIN buyers b ON b.id = o.buyer_id
       JOIN fabric_types f ON f.id = o.fabric_type_id
       JOIN order_progress p ON p.order_id = o.id
       JOIN order_costing c ON c.order_id = o.id
       LEFT JOIN users u ON u.id = o.created_by
      WHERE o.id = $1`,
    [orderId],
  );
  const order = rows[0];
  if (!order || (isBuyer(user) && order.buyer_id !== user.buyerId)) throw notFound('Order');

  const [timeline, jobs, rolls, dispatches, invoices] = await Promise.all([
    query(
      `SELECT h.from_status, h.to_status, h.note, h.changed_at, u.full_name AS changed_by_name
         FROM order_status_history h LEFT JOIN users u ON u.id = h.changed_by
        WHERE h.order_id = $1 ORDER BY h.changed_at, h.id`,
      [orderId],
    ),
    query(
      `SELECT j.id, j.job_number, j.stage, j.status, j.planned_quantity, j.produced_quantity, j.quantity_unit,
              j.started_at, j.completed_at, m.code AS machine_code, m.name AS machine_name
         FROM production_jobs j JOIN machines m ON m.id = j.machine_id
        WHERE j.order_id = $1 ORDER BY j.stage, j.created_at`,
      [orderId],
    ),
    query(
      `SELECT r.id, r.roll_number, r.length_meters, r.weight_kg, r.status, r.rack_location, r.created_at,
              m.code AS machine_code,
              (SELECT qi.grade FROM quality_inspections qi WHERE qi.fabric_roll_id = r.id ORDER BY qi.inspected_at DESC LIMIT 1) AS grade
         FROM fabric_rolls r JOIN machines m ON m.id = r.machine_id
        WHERE r.order_id = $1 ORDER BY r.created_at DESC`,
      [orderId],
    ),
    query(
      `SELECT d.id, d.dispatch_number, d.vehicle_number, d.total_rolls, d.total_meters, d.dispatched_at, i.invoice_number
         FROM dispatches d JOIN invoices i ON i.id = d.invoice_id
        WHERE d.order_id = $1 ORDER BY d.dispatched_at DESC`,
      [orderId],
    ),
    query(
      `SELECT id, invoice_number, invoice_date, due_date, total_amount, amount_paid, status
         FROM invoices WHERE order_id = $1 ORDER BY invoice_date DESC`,
      [orderId],
    ),
  ]);

  const result = {
    ...order,
    timeline: timeline.rows,
    jobs: jobs.rows,
    rolls: rolls.rows,
    dispatches: dispatches.rows,
    invoices: invoices.rows,
  };
  if (isBuyer(user)) {
    // Internal costing and staff names are not for buyers.
    for (const field of ['material_cost', 'labour_cost', 'machine_cost', 'total_cost', 'created_by_name', 'notes']) delete result[field];
    result.timeline = result.timeline.map(({ to_status, from_status, changed_at }) => ({ to_status, from_status, changed_at }));
  } else {
    result.yarnAvailability = await checkYarnAvailability({
      fabricTypeId: order.fabric_type_id,
      quantityMeters: order.quantity_meters,
      orderId: order.id,
    });
  }
  return result;
}

export async function createOrder(request, newOrder) {
  return withTransaction(async (client) => {
    const orderNumber = await nextDocumentNumber(client, 'order');
    const { rows } = await client.query(
      `INSERT INTO orders (order_number, buyer_id, fabric_type_id, colour, quantity_meters, rate_per_meter, due_date, priority, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        orderNumber,
        newOrder.buyerId,
        newOrder.fabricTypeId,
        newOrder.colour,
        newOrder.quantityMeters,
        newOrder.ratePerMeter,
        newOrder.dueDate,
        newOrder.priority,
        newOrder.notes ?? null,
        request.user.id,
      ],
    );
    const order = rows[0];
    await client.query(
      'INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by) VALUES ($1, NULL, $2, $3, $4)',
      [order.id, 'NEW', 'Order received', request.user.id],
    );
    await recordAudit(client, { request, action: 'ORDER_CREATED', entityType: 'order', entityId: order.id, details: { orderNumber } });
    return order;
  });
}

export async function updateOrder(request, orderId, changes) {
  return withTransaction(async (client) => {
    const { rows: existingRows } = await client.query('SELECT status FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    const existing = existingRows[0];
    if (!existing) throw notFound('Order');
    if (['DISPATCHED', 'CANCELLED'].includes(existing.status)) throw conflict('Closed orders cannot be edited.');

    const { rows } = await client.query(
      `UPDATE orders SET due_date = COALESCE($2, due_date), priority = COALESCE($3, priority),
              notes = COALESCE($4, notes), rate_per_meter = COALESCE($5, rate_per_meter)
        WHERE id = $1 RETURNING *`,
      [orderId, changes.dueDate, changes.priority, changes.notes, changes.ratePerMeter],
    );
    await recordAudit(client, { request, action: 'ORDER_UPDATED', entityType: 'order', entityId: orderId, details: changes });
    return rows[0];
  });
}

export async function cancelOrder(request, orderId, reason) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT o.status, p.dispatched_meters FROM orders o JOIN order_progress p ON p.order_id = o.id WHERE o.id = $1 FOR UPDATE OF o`,
      [orderId],
    );
    const order = rows[0];
    if (!order) throw notFound('Order');
    if (order.status === 'CANCELLED') return { status: 'CANCELLED' };
    if (order.dispatched_meters > 0) throw conflict('This order has already been dispatched in part and cannot be cancelled.');

    await client.query("UPDATE orders SET status = 'CANCELLED' WHERE id = $1", [orderId]);
    await client.query("UPDATE production_jobs SET status = 'ON_HOLD' WHERE order_id = $1 AND status IN ('PLANNED', 'IN_PROGRESS')", [orderId]);
    await client.query(
      'INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by) VALUES ($1, $2, $3, $4, $5)',
      [orderId, order.status, 'CANCELLED', reason, request.user.id],
    );
    await recordAudit(client, { request, action: 'ORDER_CANCELLED', entityType: 'order', entityId: orderId, details: { reason } });
    return { status: 'CANCELLED' };
  });
}
