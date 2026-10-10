import { query, withTransaction } from '../../db/pool.js';
import { ROLES } from '../../constants/roles.js';
import { recordAudit } from '../../utils/auditLog.js';
import { nextDocumentNumber } from '../../utils/documentNumbers.js';
import { conflict, notFound } from '../../utils/httpError.js';
import { roundTo2 } from '../../utils/money.js';
import { toLikePattern, toOffset, toPage } from '../../utils/pagination.js';
import { refreshOrderStatus } from '../orders/orderStatus.js';

const GST_PERCENT_ON_FABRIC = 5;
const PAYMENT_TERMS_DAYS = 30;

/** Finished fabric on the shelf (passed, not yet dispatched), grouped by order. */
export async function getFinishedGoodsStock() {
  const { rows } = await query(
    `SELECT o.id AS order_id, o.order_number, o.colour, o.quantity_meters, o.rate_per_meter, o.due_date, o.status,
            b.company_name AS buyer_name, f.name AS fabric_name,
            count(r.id) AS rolls_on_shelf, sum(r.length_meters) AS meters_on_shelf,
            array_agg(DISTINCT r.rack_location) FILTER (WHERE r.rack_location IS NOT NULL) AS rack_locations,
            p.dispatched_meters
       FROM fabric_rolls r
       JOIN orders o ON o.id = r.order_id
       JOIN buyers b ON b.id = o.buyer_id
       JOIN fabric_types f ON f.id = o.fabric_type_id
       JOIN order_progress p ON p.order_id = o.id
      WHERE r.status = 'PASSED'
      GROUP BY o.id, b.company_name, f.name, p.dispatched_meters
      ORDER BY o.due_date`,
  );
  return rows;
}

export async function listDispatches(user, { search, page, pageSize }) {
  const buyerScope = user.role === ROLES.BUYER ? user.buyerId : null;
  const { rows } = await query(
    `SELECT d.id, d.dispatch_number, d.vehicle_number, d.driver_name, d.total_rolls, d.total_meters, d.dispatched_at,
            o.order_number, b.company_name AS buyer_name, i.id AS invoice_id, i.invoice_number, i.total_amount, i.status AS invoice_status,
            count(*) OVER () AS total_count
       FROM dispatches d
       JOIN orders o ON o.id = d.order_id
       JOIN buyers b ON b.id = d.buyer_id
       JOIN invoices i ON i.id = d.invoice_id
      WHERE ($1 = '' OR d.dispatch_number ILIKE $2 OR o.order_number ILIKE $2 OR b.company_name ILIKE $2 OR d.vehicle_number ILIKE $2)
        AND ($3::bigint IS NULL OR d.buyer_id = $3)
      ORDER BY d.dispatched_at DESC
      LIMIT $4 OFFSET $5`,
    [search, toLikePattern(search), buyerScope, pageSize, toOffset({ page, pageSize })],
  );
  return toPage(rows, { page, pageSize });
}

/** Delivery challan + invoice in one payload, ready to print. */
export async function getDispatchDocument(user, dispatchId) {
  const { rows } = await query(
    `SELECT d.*, o.order_number, o.colour, f.name AS fabric_name,
            b.company_name AS buyer_name, b.address AS buyer_address, b.gst_number AS buyer_gst, b.phone AS buyer_phone,
            i.invoice_number, i.invoice_date, i.due_date AS invoice_due_date, i.rate_per_meter, i.subtotal,
            i.tax_percent, i.tax_amount, i.total_amount, i.amount_paid, i.status AS invoice_status
       FROM dispatches d
       JOIN orders o ON o.id = d.order_id
       JOIN fabric_types f ON f.id = o.fabric_type_id
       JOIN buyers b ON b.id = d.buyer_id
       JOIN invoices i ON i.id = d.invoice_id
      WHERE d.id = $1`,
    [dispatchId],
  );
  const dispatch = rows[0];
  if (!dispatch || (user.role === ROLES.BUYER && dispatch.buyer_id !== user.buyerId)) throw notFound('Dispatch');
  const { rows: items } = await query(
    `SELECT r.roll_number, di.length_meters, r.weight_kg,
            (SELECT qi.grade FROM quality_inspections qi WHERE qi.fabric_roll_id = r.id ORDER BY qi.inspected_at DESC LIMIT 1) AS grade
       FROM dispatch_items di JOIN fabric_rolls r ON r.id = di.fabric_roll_id
      WHERE di.dispatch_id = $1 ORDER BY r.roll_number`,
    [dispatchId],
  );
  return { ...dispatch, items };
}

/**
 * Load the truck. Only PASSED rolls of this order can go; rows are locked so two clerks
 * cannot dispatch the same roll, and dispatch_items.fabric_roll_id is UNIQUE as a final guard.
 * The invoice is generated from exactly the rolls on the truck, so quantity and bill always match.
 */
export async function createDispatch(request, { orderId, rollIds, vehicleNumber, driverName, driverPhone }) {
  return withTransaction(async (client) => {
    const { rows: orderRows } = await client.query(
      'SELECT id, order_number, buyer_id, rate_per_meter, status FROM orders WHERE id = $1 FOR UPDATE',
      [orderId],
    );
    const order = orderRows[0];
    if (!order) throw notFound('Order');
    if (order.status === 'CANCELLED') throw conflict('This order is cancelled.');

    const uniqueRollIds = [...new Set(rollIds)].sort((first, second) => first - second);
    const { rows: rolls } = await client.query(
      `SELECT id, roll_number, order_id, status, length_meters FROM fabric_rolls WHERE id = ANY($1::bigint[]) ORDER BY id FOR UPDATE`,
      [uniqueRollIds],
    );
    if (rolls.length !== uniqueRollIds.length) throw notFound('One or more rolls');
    const wrongOrder = rolls.filter((roll) => roll.order_id !== orderId);
    if (wrongOrder.length) throw conflict(`Rolls ${wrongOrder.map((roll) => roll.roll_number).join(', ')} belong to another order.`);
    const notReady = rolls.filter((roll) => roll.status !== 'PASSED');
    if (notReady.length) {
      throw conflict(`Only passed rolls can be dispatched. Not ready: ${notReady.map((roll) => `${roll.roll_number} (${roll.status})`).join(', ')}.`);
    }

    const totalMeters = roundTo2(rolls.reduce((sum, roll) => sum + roll.length_meters, 0));
    const subtotal = roundTo2(totalMeters * order.rate_per_meter);
    const taxAmount = roundTo2((subtotal * GST_PERCENT_ON_FABRIC) / 100);

    const invoiceNumber = await nextDocumentNumber(client, 'invoice');
    const { rows: invoiceRows } = await client.query(
      `INSERT INTO invoices (invoice_number, order_id, buyer_id, due_date, total_meters, rate_per_meter, subtotal, tax_percent, tax_amount, total_amount)
       VALUES ($1, $2, $3, CURRENT_DATE + $4::int, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [invoiceNumber, orderId, order.buyer_id, PAYMENT_TERMS_DAYS, totalMeters, order.rate_per_meter, subtotal, GST_PERCENT_ON_FABRIC, taxAmount, roundTo2(subtotal + taxAmount)],
    );
    const invoice = invoiceRows[0];

    const dispatchNumber = await nextDocumentNumber(client, 'dispatch');
    const { rows: dispatchRows } = await client.query(
      `INSERT INTO dispatches (dispatch_number, order_id, buyer_id, invoice_id, vehicle_number, driver_name, driver_phone, total_rolls, total_meters, dispatched_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [dispatchNumber, orderId, order.buyer_id, invoice.id, vehicleNumber, driverName ?? null, driverPhone ?? null, rolls.length, totalMeters, request.user.id],
    );
    const dispatch = dispatchRows[0];

    await client.query(
      `INSERT INTO dispatch_items (dispatch_id, fabric_roll_id, length_meters)
       SELECT $1, r.id, r.length_meters FROM fabric_rolls r WHERE r.id = ANY($2::bigint[])`,
      [dispatch.id, uniqueRollIds],
    );
    await client.query(`UPDATE fabric_rolls SET status = 'DISPATCHED' WHERE id = ANY($1::bigint[])`, [uniqueRollIds]);
    await refreshOrderStatus(client, orderId, { userId: request.user.id, note: `${dispatchNumber} · ${rolls.length} rolls on ${vehicleNumber}` });
    await recordAudit(client, {
      request,
      action: 'ORDER_DISPATCHED',
      entityType: 'dispatch',
      entityId: dispatch.id,
      details: { dispatchNumber, invoiceNumber, totalMeters, rolls: rolls.length },
    });
    return { ...dispatch, invoice };
  });
}
