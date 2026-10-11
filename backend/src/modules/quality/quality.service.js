import { query, withTransaction } from '../../db/pool.js';
import { recordAudit } from '../../utils/auditLog.js';
import { nextDocumentNumber } from '../../utils/documentNumbers.js';
import { conflict, notFound } from '../../utils/httpError.js';
import { toLikePattern, toOffset, toPage } from '../../utils/pagination.js';
import { refreshOrderStatus } from '../orders/orderStatus.js';

const ROLL_STATUS_BY_RESULT = Object.freeze({ PASS: 'PASSED', REWORK: 'REWORK', REJECT: 'REJECTED' });

// ---------------------------------------------------------------- rolls

export async function listRolls({ search, page, pageSize, status, orderId }) {
  const { rows } = await query(
    `SELECT r.id, r.roll_number, r.length_meters, r.weight_kg, r.status, r.rack_location, r.created_at,
            o.id AS order_id, o.order_number, o.colour, b.company_name AS buyer_name, f.name AS fabric_name,
            m.code AS machine_code,
            last_check.grade, last_check.inspected_at,
            count(*) OVER () AS total_count
       FROM fabric_rolls r
       JOIN orders o ON o.id = r.order_id
       JOIN buyers b ON b.id = o.buyer_id
       JOIN fabric_types f ON f.id = o.fabric_type_id
       JOIN machines m ON m.id = r.machine_id
       LEFT JOIN LATERAL (
         SELECT qi.grade, qi.inspected_at FROM quality_inspections qi
          WHERE qi.fabric_roll_id = r.id ORDER BY qi.inspected_at DESC LIMIT 1
       ) last_check ON true
      WHERE ($1 = '' OR r.roll_number ILIKE $2 OR o.order_number ILIKE $2 OR b.company_name ILIKE $2)
        AND ($3::roll_status IS NULL OR r.status = $3)
        AND ($4::bigint IS NULL OR r.order_id = $4)
      ORDER BY r.created_at DESC
      LIMIT $5 OFFSET $6`,
    [search, toLikePattern(search), status ?? null, orderId ?? null, pageSize, toOffset({ page, pageSize })],
  );
  return toPage(rows, { page, pageSize });
}

export async function createRoll(request, { orderId, machineId, productionJobId, lengthMeters, weightKg, rackLocation }) {
  return withTransaction(async (client) => {
    const { rows: orderRows } = await client.query('SELECT status FROM orders WHERE id = $1', [orderId]);
    if (!orderRows[0]) throw notFound('Order');
    if (['DISPATCHED', 'CANCELLED'].includes(orderRows[0].status)) throw conflict('This order is closed.');
    if (productionJobId) {
      const { rows: jobRows } = await client.query('SELECT order_id FROM production_jobs WHERE id = $1', [productionJobId]);
      if (!jobRows[0] || jobRows[0].order_id !== orderId) throw conflict('That job belongs to a different order.');
    }

    const rollNumber = await nextDocumentNumber(client, 'fabricRoll');
    const { rows } = await client.query(
      `INSERT INTO fabric_rolls (roll_number, order_id, machine_id, production_job_id, length_meters, weight_kg, rack_location, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [rollNumber, orderId, machineId, productionJobId ?? null, lengthMeters, weightKg ?? null, rackLocation ?? null, request.user.id],
    );
    await refreshOrderStatus(client, orderId, { userId: request.user.id });
    await recordAudit(client, { request, action: 'ROLL_CREATED', entityType: 'fabric_roll', entityId: rows[0].id, details: { rollNumber } });
    return rows[0];
  });
}

/** Full trace of one roll: which order, buyer, machine and job it came from, every inspection and its dispatch. */
export async function traceRoll(rollId) {
  const { rows } = await query(
    `SELECT r.*, o.order_number, o.colour, b.company_name AS buyer_name, f.name AS fabric_name,
            m.code AS machine_code, m.name AS machine_name, m.stage AS machine_stage,
            j.job_number, u.full_name AS created_by_name,
            d.dispatch_number, d.dispatched_at, d.vehicle_number
       FROM fabric_rolls r
       JOIN orders o ON o.id = r.order_id
       JOIN buyers b ON b.id = o.buyer_id
       JOIN fabric_types f ON f.id = o.fabric_type_id
       JOIN machines m ON m.id = r.machine_id
       LEFT JOIN production_jobs j ON j.id = r.production_job_id
       LEFT JOIN users u ON u.id = r.created_by
       LEFT JOIN dispatch_items di ON di.fabric_roll_id = r.id
       LEFT JOIN dispatches d ON d.id = di.dispatch_id
      WHERE r.id = $1`,
    [rollId],
  );
  if (!rows[0]) throw notFound('Roll');
  const { rows: inspections } = await query(
    `SELECT qi.id, qi.result, qi.grade, qi.defect_points, qi.remarks, qi.photo_url, qi.inspected_at, u.full_name AS inspector_name,
            COALESCE(json_agg(json_build_object('defectType', d.defect_type, 'occurrences', d.occurrences, 'note', d.note))
                     FILTER (WHERE d.id IS NOT NULL), '[]') AS defects
       FROM quality_inspections qi
       LEFT JOIN users u ON u.id = qi.inspector_id
       LEFT JOIN inspection_defects d ON d.quality_inspection_id = qi.id
      WHERE qi.fabric_roll_id = $1
      GROUP BY qi.id, u.full_name
      ORDER BY qi.inspected_at DESC`,
    [rollId],
  );
  return { ...rows[0], inspections };
}

// ---------------------------------------------------------------- inspections

export async function inspectRoll(request, { fabricRollId, result, grade, remarks, photo, photoUrl, defects }) {
  const finalPhoto = photoUrl ?? photo ?? null;
  return withTransaction(async (client) => {
    const { rows } = await client.query('SELECT id, order_id, status, roll_number FROM fabric_rolls WHERE id = $1 FOR UPDATE', [fabricRollId]);
    const roll = rows[0];
    if (!roll) throw notFound('Roll');
    if (!['PENDING_QC', 'REWORK'].includes(roll.status)) {
      throw conflict(`Roll ${roll.roll_number} is ${roll.status.toLowerCase().replace('_', ' ')} and cannot be inspected again.`);
    }

    // Simplified four-point system: every defect occurrence counts as points against the roll.
    const defectPoints = defects.reduce((total, defect) => total + defect.occurrences, 0);
    const { rows: inspectionRows } = await client.query(
      `INSERT INTO quality_inspections (fabric_roll_id, inspector_id, result, grade, defect_points, remarks, photo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [fabricRollId, request.user.id, result, result === 'REJECT' ? null : grade ?? null, defectPoints, remarks ?? null, finalPhoto],
    );
    const inspection = inspectionRows[0];
    for (const defect of defects) {
      await client.query(
        'INSERT INTO inspection_defects (quality_inspection_id, defect_type, occurrences, note) VALUES ($1, $2, $3, $4)',
        [inspection.id, defect.defectType, defect.occurrences, defect.note ?? null],
      );
    }
    await client.query('UPDATE fabric_rolls SET status = $2 WHERE id = $1', [fabricRollId, ROLL_STATUS_BY_RESULT[result]]);
    await refreshOrderStatus(client, roll.order_id, { userId: request.user.id });
    await recordAudit(client, {
      request,
      action: 'ROLL_INSPECTED',
      entityType: 'fabric_roll',
      entityId: fabricRollId,
      details: { result, grade, defectPoints },
    });
    return inspection;
  });
}

/** Pass rate, defect Pareto and defects by machine, so a recurring fault points to its cause. */
export async function getQualitySummary({ days }) {
  const [totals, defectsByType, defectsByMachine] = await Promise.all([
    query(
      `SELECT count(*) AS inspections,
              count(*) FILTER (WHERE result = 'PASS') AS passed,
              count(*) FILTER (WHERE result = 'REWORK') AS rework,
              count(*) FILTER (WHERE result = 'REJECT') AS rejected,
              (SELECT count(*) FROM fabric_rolls WHERE status IN ('PENDING_QC', 'REWORK')) AS waiting_for_check
         FROM quality_inspections WHERE inspected_at >= now() - make_interval(days => $1)`,
      [days],
    ),
    query(
      `SELECT d.defect_type, sum(d.occurrences) AS occurrences
         FROM inspection_defects d JOIN quality_inspections qi ON qi.id = d.quality_inspection_id
        WHERE qi.inspected_at >= now() - make_interval(days => $1)
        GROUP BY d.defect_type ORDER BY occurrences DESC`,
      [days],
    ),
    query(
      `SELECT m.code AS machine_code, m.stage,
              count(DISTINCT qi.id) AS inspections,
              count(DISTINCT qi.id) FILTER (WHERE qi.result <> 'PASS') AS failed,
              COALESCE(sum(d.occurrences), 0) AS defect_count
         FROM quality_inspections qi
         JOIN fabric_rolls r ON r.id = qi.fabric_roll_id
         JOIN machines m ON m.id = r.machine_id
         LEFT JOIN inspection_defects d ON d.quality_inspection_id = qi.id
        WHERE qi.inspected_at >= now() - make_interval(days => $1)
        GROUP BY m.id ORDER BY defect_count DESC LIMIT 10`,
      [days],
    ),
  ]);
  const summary = totals.rows[0];
  return {
    ...summary,
    passRate: summary.inspections > 0 ? Math.round((summary.passed / summary.inspections) * 1000) / 10 : null,
    defectsByType: defectsByType.rows,
    defectsByMachine: defectsByMachine.rows,
  };
}
