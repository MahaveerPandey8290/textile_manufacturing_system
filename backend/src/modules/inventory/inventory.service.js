import { query, withTransaction } from '../../db/pool.js';
import { recordAudit } from '../../utils/auditLog.js';
import { nextDocumentNumber } from '../../utils/documentNumbers.js';
import { badRequest, conflict, notFound } from '../../utils/httpError.js';
import { roundTo2 } from '../../utils/money.js';
import { toLikePattern, toOffset, toPage } from '../../utils/pagination.js';

// ---------------------------------------------------------------- yarn types

export async function listYarnTypes({ search, page, pageSize, lowStockOnly = false }) {
  const { rows } = await query(
    `SELECT y.*, (y.current_stock_kg <= y.reorder_level_kg) AS is_low_stock,
            round(y.current_stock_kg * y.average_cost_per_kg, 2) AS stock_value,
            count(*) OVER () AS total_count
       FROM yarn_types y
      WHERE ($1 = '' OR (y.code || ' ' || y.name || ' ' || y.colour) ILIKE $2)
        AND (NOT $5 OR y.current_stock_kg <= y.reorder_level_kg)
      ORDER BY (y.current_stock_kg <= y.reorder_level_kg) DESC, y.name
      LIMIT $3 OFFSET $4`,
    [search, toLikePattern(search), pageSize, toOffset({ page, pageSize }), lowStockOnly],
  );
  return toPage(rows, { page, pageSize });
}

export async function createYarnType(request, yarnType) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO yarn_types (code, name, material, yarn_count, colour, reorder_level_kg, average_cost_per_kg)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [yarnType.code, yarnType.name, yarnType.material, yarnType.yarnCount, yarnType.colour, yarnType.reorderLevelKg, yarnType.costPerKg ?? 0],
    );
    await recordAudit(client, { request, action: 'YARN_TYPE_CREATED', entityType: 'yarn_type', entityId: rows[0].id });
    return rows[0];
  });
}

export async function updateYarnType(request, yarnTypeId, changes) {
  const { rows } = await query(
    `UPDATE yarn_types SET name = COALESCE($2, name), colour = COALESCE($3, colour),
            reorder_level_kg = COALESCE($4, reorder_level_kg)
      WHERE id = $1 RETURNING *`,
    [yarnTypeId, changes.name, changes.colour, changes.reorderLevelKg],
  );
  if (!rows[0]) throw notFound('Yarn type');
  return rows[0];
}

export async function listStockMovements(yarnTypeId, { page, pageSize }) {
  const { rows } = await query(
    `SELECT m.id, m.movement_type, m.quantity_kg, m.cost_per_kg, m.note, m.created_at,
            o.order_number, r.receipt_number, u.full_name AS created_by_name,
            count(*) OVER () AS total_count
       FROM yarn_stock_movements m
       LEFT JOIN orders o ON o.id = m.order_id
       LEFT JOIN yarn_receipts r ON r.id = m.yarn_receipt_id
       LEFT JOIN users u ON u.id = m.created_by
      WHERE m.yarn_type_id = $1
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT $2 OFFSET $3`,
    [yarnTypeId, pageSize, toOffset({ page, pageSize })],
  );
  return toPage(rows, { page, pageSize });
}

// ---------------------------------------------------------------- fabric types

export async function listFabricTypes() {
  const { rows } = await query(
    `SELECT f.*, y.name AS yarn_name, y.code AS yarn_code
       FROM fabric_types f JOIN yarn_types y ON y.id = f.yarn_type_id
      ORDER BY f.name`,
  );
  return rows;
}

export async function createFabricType(request, fabricType) {
  const { rows } = await query(
    `INSERT INTO fabric_types (name, construction, gsm, width_inches, yarn_type_id, yarn_kg_per_meter)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [fabricType.name, fabricType.construction, fabricType.gsm, fabricType.widthInches, fabricType.yarnTypeId, fabricType.yarnKgPerMeter],
  );
  return rows[0];
}

// ---------------------------------------------------------------- stock ledger core

/**
 * The single place where yarn stock changes. Locks the yarn row, guards against negative stock,
 * updates the running balance (and weighted average cost on receipts) and writes the ledger line.
 */
async function moveYarnStock(client, { yarnTypeId, movementType, quantityKg, costPerKg, orderId, yarnReceiptId, note, userId }) {
  const { rows } = await client.query(
    'SELECT id, name, current_stock_kg, average_cost_per_kg FROM yarn_types WHERE id = $1 FOR UPDATE',
    [yarnTypeId],
  );
  const yarn = rows[0];
  if (!yarn) throw notFound('Yarn type');

  const newBalance = roundTo2(yarn.current_stock_kg + quantityKg);
  if (newBalance < 0) {
    throw conflict(`Not enough ${yarn.name} in stock. Available: ${yarn.current_stock_kg} kg, requested: ${Math.abs(quantityKg)} kg.`);
  }

  // Receipts move the weighted average cost; issues are valued at the current average.
  let averageCost = yarn.average_cost_per_kg;
  if (movementType === 'RECEIPT' && newBalance > 0) {
    averageCost = roundTo2((yarn.current_stock_kg * yarn.average_cost_per_kg + quantityKg * costPerKg) / newBalance);
  }
  const movementCost = movementType === 'RECEIPT' ? costPerKg : yarn.average_cost_per_kg;

  await client.query('UPDATE yarn_types SET current_stock_kg = $2, average_cost_per_kg = $3 WHERE id = $1', [
    yarnTypeId,
    newBalance,
    averageCost,
  ]);
  await client.query(
    `INSERT INTO yarn_stock_movements
       (yarn_type_id, movement_type, quantity_kg, cost_per_kg, order_id, yarn_receipt_id, note, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [yarnTypeId, movementType, quantityKg, movementCost, orderId ?? null, yarnReceiptId ?? null, note ?? null, userId],
  );
  return { yarnTypeId, newBalance };
}

// ---------------------------------------------------------------- yarn receipts (gate entry / GRN)

export async function listYarnReceipts({ search, page, pageSize }) {
  const { rows } = await query(
    `SELECT r.id, r.receipt_number, r.received_at, r.vehicle_number, r.challan_number, r.bill_number,
            r.total_amount, r.amount_paid, (r.total_amount - r.amount_paid) AS balance_due,
            s.company_name AS supplier_name, o.order_number, u.full_name AS received_by_name,
            (SELECT COALESCE(sum(quantity_kg), 0) FROM yarn_receipt_items i WHERE i.yarn_receipt_id = r.id) AS total_kg,
            (SELECT string_agg(y.name, ', ') FROM yarn_receipt_items i JOIN yarn_types y ON y.id = i.yarn_type_id
              WHERE i.yarn_receipt_id = r.id) AS yarn_summary,
            count(*) OVER () AS total_count
       FROM yarn_receipts r
       JOIN suppliers s ON s.id = r.supplier_id
       LEFT JOIN orders o ON o.id = r.order_id
       LEFT JOIN users u ON u.id = r.received_by
      WHERE ($1 = '' OR r.receipt_number ILIKE $2 OR s.company_name ILIKE $2 OR r.challan_number ILIKE $2)
      ORDER BY r.received_at DESC
      LIMIT $3 OFFSET $4`,
    [search, toLikePattern(search), pageSize, toOffset({ page, pageSize })],
  );
  return toPage(rows, { page, pageSize });
}

export async function receiveYarn(request, { supplierId, orderId, vehicleNumber, challanNumber, billNumber, items }) {
  return withTransaction(async (client) => {
    const receiptNumber = await nextDocumentNumber(client, 'yarnReceipt');
    const totalAmount = roundTo2(items.reduce((sum, item) => sum + item.quantityKg * item.costPerKg, 0));
    const { rows } = await client.query(
      `INSERT INTO yarn_receipts (receipt_number, supplier_id, order_id, vehicle_number, challan_number, bill_number, total_amount, received_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [receiptNumber, supplierId, orderId ?? null, vehicleNumber, challanNumber, billNumber, totalAmount, request.user.id],
    );
    const receipt = rows[0];

    // Lock yarn rows in a stable order to avoid deadlocks between concurrent receipts.
    const sortedItems = [...items].sort((first, second) => first.yarnTypeId - second.yarnTypeId);
    for (const item of sortedItems) {
      await client.query(
        'INSERT INTO yarn_receipt_items (yarn_receipt_id, yarn_type_id, quantity_kg, cost_per_kg) VALUES ($1, $2, $3, $4)',
        [receipt.id, item.yarnTypeId, item.quantityKg, item.costPerKg],
      );
      await moveYarnStock(client, {
        yarnTypeId: item.yarnTypeId,
        movementType: 'RECEIPT',
        quantityKg: item.quantityKg,
        costPerKg: item.costPerKg,
        yarnReceiptId: receipt.id,
        note: `Received via ${receiptNumber}`,
        userId: request.user.id,
      });
    }
    await recordAudit(client, {
      request,
      action: 'YARN_RECEIVED',
      entityType: 'yarn_receipt',
      entityId: receipt.id,
      details: { receiptNumber, totalAmount, lines: items.length },
    });
    return receipt;
  });
}

// ---------------------------------------------------------------- issues and adjustments

export async function issueYarnToOrder(request, { orderId, yarnTypeId, quantityKg, note }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query('SELECT id, order_number, status FROM orders WHERE id = $1', [orderId]);
    const order = rows[0];
    if (!order) throw notFound('Order');
    if (['DISPATCHED', 'CANCELLED'].includes(order.status)) throw conflict(`Order ${order.order_number} is closed.`);

    const result = await moveYarnStock(client, {
      yarnTypeId,
      movementType: 'ISSUE',
      quantityKg: -quantityKg,
      orderId,
      note: note ?? `Issued to ${order.order_number}`,
      userId: request.user.id,
    });
    await recordAudit(client, {
      request,
      action: 'YARN_ISSUED',
      entityType: 'order',
      entityId: orderId,
      details: { yarnTypeId, quantityKg },
    });
    return result;
  });
}

export async function adjustYarnStock(request, { yarnTypeId, quantityKg, note }) {
  if (quantityKg === 0) throw badRequest('Adjustment quantity cannot be zero.');
  return withTransaction(async (client) => {
    const result = await moveYarnStock(client, {
      yarnTypeId,
      movementType: 'ADJUSTMENT',
      quantityKg,
      note,
      userId: request.user.id,
    });
    await recordAudit(client, { request, action: 'YARN_ADJUSTED', entityType: 'yarn_type', entityId: yarnTypeId, details: { quantityKg, note } });
    return result;
  });
}

// ---------------------------------------------------------------- material planning

/**
 * "Do we have enough yarn to start this?" Works for an existing order or a prospective one
 * (fabric type + meters), so the office can answer while the buyer is still on the phone.
 */
export async function checkYarnAvailability({ fabricTypeId, quantityMeters, orderId }) {
  const { rows } = await query(
    `SELECT f.id AS fabric_type_id, f.name AS fabric_name, f.yarn_kg_per_meter,
            y.id AS yarn_type_id, y.name AS yarn_name, y.code AS yarn_code,
            y.current_stock_kg, y.average_cost_per_kg,
            COALESCE((SELECT -sum(m.quantity_kg) FROM yarn_stock_movements m
                       WHERE m.order_id = $2 AND m.yarn_type_id = y.id AND m.movement_type IN ('ISSUE', 'RETURN')), 0) AS already_issued_kg
       FROM fabric_types f JOIN yarn_types y ON y.id = f.yarn_type_id
      WHERE f.id = $1`,
    [fabricTypeId, orderId ?? null],
  );
  const plan = rows[0];
  if (!plan) throw notFound('Fabric type');

  const requiredKg = roundTo2(quantityMeters * plan.yarn_kg_per_meter);
  const stillNeededKg = roundTo2(Math.max(0, requiredKg - plan.already_issued_kg));
  const shortfallKg = roundTo2(Math.max(0, stillNeededKg - plan.current_stock_kg));
  return {
    fabricTypeId: plan.fabric_type_id,
    fabricName: plan.fabric_name,
    yarnTypeId: plan.yarn_type_id,
    yarnName: `${plan.yarn_code} · ${plan.yarn_name}`,
    requiredKg,
    alreadyIssuedKg: plan.already_issued_kg,
    stillNeededKg,
    availableKg: plan.current_stock_kg,
    shortfallKg,
    canStart: shortfallKg === 0,
    estimatedMaterialCost: roundTo2(requiredKg * plan.average_cost_per_kg),
  };
}
