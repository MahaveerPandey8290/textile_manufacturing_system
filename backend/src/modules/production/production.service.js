import { query, withTransaction } from '../../db/pool.js';
import { recordAudit } from '../../utils/auditLog.js';
import { nextDocumentNumber } from '../../utils/documentNumbers.js';
import { conflict, notFound } from '../../utils/httpError.js';
import { roundTo2 } from '../../utils/money.js';
import { refreshOrderStatus } from '../orders/orderStatus.js';

const STANDARD_SHIFT_HOURS = 8;
const QUANTITY_UNIT_BY_STAGE = Object.freeze({ SPINNING: 'kg', WEAVING: 'm', DYEING: 'm' });

// ---------------------------------------------------------------- machine board

/** Everything the floor screen needs in one round trip: status, current job, today's output, open breakdown. */
export async function getMachineBoard({ stage } = {}) {
  const { rows } = await query(
    `SELECT m.id, m.code, m.name, m.stage, m.status, m.location, m.hourly_running_cost, m.status_changed_at,
            job.id AS job_id, job.job_number, job.planned_quantity, job.produced_quantity, job.quantity_unit, job.started_at,
            o.id AS order_id, o.order_number, o.colour, b.company_name AS buyer_name,
            COALESCE(today.quantity, 0) AS output_today,
            COALESCE(today.hours, 0) AS hours_today,
            downtime.reason AS downtime_reason, downtime.started_at AS downtime_started_at
       FROM machines m
       LEFT JOIN production_jobs job ON job.machine_id = m.id AND job.status = 'IN_PROGRESS'
       LEFT JOIN orders o ON o.id = job.order_id
       LEFT JOIN buyers b ON b.id = o.buyer_id
       LEFT JOIN LATERAL (
         SELECT sum(pl.quantity_produced) AS quantity, sum(pl.hours_worked) AS hours
           FROM production_logs pl
          WHERE pl.machine_id = m.id AND pl.logged_at >= date_trunc('day', now())
       ) today ON true
       LEFT JOIN machine_downtimes downtime ON downtime.machine_id = m.id AND downtime.ended_at IS NULL
      WHERE ($1::production_stage IS NULL OR m.stage = $1)
      ORDER BY m.stage, m.code`,
    [stage ?? null],
  );
  const summary = rows.reduce(
    (counts, machine) => ({ ...counts, [machine.status]: (counts[machine.status] ?? 0) + 1 }),
    { RUNNING: 0, IDLE: 0, BREAKDOWN: 0, MAINTENANCE: 0 },
  );
  return { summary, machines: rows };
}

export async function createMachine(request, machine) {
  const { rows } = await query(
    `INSERT INTO machines (code, name, stage, hourly_running_cost, location) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [machine.code, machine.name, machine.stage, machine.hourlyRunningCost, machine.location ?? null],
  );
  return rows[0];
}

/** Breakdowns and maintenance open a downtime record (and pause the running job); recovering closes it. */
export async function changeMachineStatus(request, machineId, { status, reason }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query('SELECT id, code, status FROM machines WHERE id = $1 FOR UPDATE', [machineId]);
    const machine = rows[0];
    if (!machine) throw notFound('Machine');
    if (machine.status === status) return machine;

    const isGoingDown = status === 'BREAKDOWN' || status === 'MAINTENANCE';
    if (isGoingDown) {
      await client.query(
        `UPDATE production_jobs SET status = 'ON_HOLD' WHERE machine_id = $1 AND status = 'IN_PROGRESS'`,
        [machineId],
      );
      await client.query('UPDATE machine_downtimes SET ended_at = now() WHERE machine_id = $1 AND ended_at IS NULL', [machineId]);
      await client.query('INSERT INTO machine_downtimes (machine_id, reason, reported_by) VALUES ($1, $2, $3)', [
        machineId,
        reason ?? (status === 'BREAKDOWN' ? 'Breakdown' : 'Planned maintenance'),
        request.user.id,
      ]);
    } else {
      await client.query('UPDATE machine_downtimes SET ended_at = now() WHERE machine_id = $1 AND ended_at IS NULL', [machineId]);
      if (status === 'RUNNING') {
        const { rows: activeJobs } = await client.query(
          `SELECT 1 FROM production_jobs WHERE machine_id = $1 AND status = 'IN_PROGRESS'`,
          [machineId],
        );
        if (activeJobs.length === 0) throw conflict('Start or resume a job on this machine to mark it running.');
      }
    }
    const { rows: updatedRows } = await client.query(
      'UPDATE machines SET status = $2, status_changed_at = now() WHERE id = $1 RETURNING *',
      [machineId, status],
    );
    await recordAudit(client, {
      request,
      action: 'MACHINE_STATUS_CHANGED',
      entityType: 'machine',
      entityId: machineId,
      details: { from: machine.status, to: status, reason },
    });
    return updatedRows[0];
  });
}

export async function listDowntimes({ machineId, from, to }) {
  const { rows } = await query(
    `SELECT d.id, d.reason, d.started_at, d.ended_at, m.code AS machine_code, m.name AS machine_name,
            round(extract(epoch FROM (COALESCE(d.ended_at, now()) - d.started_at)) / 3600, 2) AS hours_down,
            u.full_name AS reported_by_name
       FROM machine_downtimes d
       JOIN machines m ON m.id = d.machine_id
       LEFT JOIN users u ON u.id = d.reported_by
      WHERE ($1::bigint IS NULL OR d.machine_id = $1)
        AND d.started_at >= COALESCE($2::date, CURRENT_DATE - 30)
        AND d.started_at < COALESCE($3::date, CURRENT_DATE) + 1
      ORDER BY d.started_at DESC
      LIMIT 200`,
    [machineId ?? null, from ?? null, to ?? null],
  );
  return rows;
}

export async function listShifts() {
  const { rows } = await query('SELECT * FROM shifts ORDER BY starts_at');
  return rows;
}

// ---------------------------------------------------------------- jobs

export async function listJobs({ status, stage, orderId }) {
  const { rows } = await query(
    `SELECT j.*, m.code AS machine_code, m.name AS machine_name, m.status AS machine_status,
            o.order_number, o.colour, o.due_date, o.priority, o.status AS order_status, b.company_name AS buyer_name
       FROM production_jobs j
       JOIN machines m ON m.id = j.machine_id
       JOIN orders o ON o.id = j.order_id
       JOIN buyers b ON b.id = o.buyer_id
      WHERE ($1::job_status IS NULL OR j.status = $1)
        AND ($2::production_stage IS NULL OR j.stage = $2)
        AND ($3::bigint IS NULL OR j.order_id = $3)
      ORDER BY CASE j.status WHEN 'IN_PROGRESS' THEN 0 WHEN 'ON_HOLD' THEN 1 WHEN 'PLANNED' THEN 2 ELSE 3 END,
               o.due_date, j.id
      LIMIT 300`,
    [status ?? null, stage ?? null, orderId ?? null],
  );
  return rows;
}

export async function createJob(request, { orderId, stage, machineId, plannedQuantity }) {
  return withTransaction(async (client) => {
    const { rows: orderRows } = await client.query('SELECT status, order_number FROM orders WHERE id = $1', [orderId]);
    if (!orderRows[0]) throw notFound('Order');
    if (['DISPATCHED', 'CANCELLED'].includes(orderRows[0].status)) throw conflict('This order is closed.');

    const { rows: machineRows } = await client.query('SELECT stage FROM machines WHERE id = $1', [machineId]);
    if (!machineRows[0]) throw notFound('Machine');
    if (machineRows[0].stage !== stage) throw conflict(`This machine is a ${machineRows[0].stage.toLowerCase()} machine.`);

    const jobNumber = await nextDocumentNumber(client, 'productionJob');
    const { rows } = await client.query(
      `INSERT INTO production_jobs (job_number, order_id, stage, machine_id, planned_quantity, quantity_unit, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [jobNumber, orderId, stage, machineId, plannedQuantity, QUANTITY_UNIT_BY_STAGE[stage], request.user.id],
    );
    await refreshOrderStatus(client, orderId, { userId: request.user.id, note: `${stage.toLowerCase()} planned` });
    await recordAudit(client, { request, action: 'JOB_CREATED', entityType: 'production_job', entityId: rows[0].id, details: { jobNumber } });
    return rows[0];
  });
}

/** start | hold | complete | reassign a job, keeping the machine status in step. */
export async function changeJobState(request, jobId, { action, machineId }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT j.*, m.status AS machine_status FROM production_jobs j JOIN machines m ON m.id = j.machine_id
        WHERE j.id = $1 FOR UPDATE OF j`,
      [jobId],
    );
    const job = rows[0];
    if (!job) throw notFound('Job');
    if (job.status === 'COMPLETED') throw conflict('This job is already completed.');

    if (action === 'start') {
      if (['BREAKDOWN', 'MAINTENANCE'].includes(job.machine_status)) throw conflict('This machine is down. Move the job to another machine first.');
      const { rows: busy } = await client.query(
        `SELECT job_number FROM production_jobs WHERE machine_id = $1 AND status = 'IN_PROGRESS' AND id <> $2`,
        [job.machine_id, jobId],
      );
      if (busy[0]) throw conflict(`This machine is busy with ${busy[0].job_number}. Hold or complete it first.`);
      await client.query(
        `UPDATE production_jobs SET status = 'IN_PROGRESS', started_at = COALESCE(started_at, now()) WHERE id = $1`,
        [jobId],
      );
      await client.query(`UPDATE machines SET status = 'RUNNING', status_changed_at = now() WHERE id = $1`, [job.machine_id]);
    } else if (action === 'hold' || action === 'complete') {
      const nextStatus = action === 'hold' ? 'ON_HOLD' : 'COMPLETED';
      await client.query(
        `UPDATE production_jobs SET status = $2::job_status, completed_at = CASE WHEN $2::job_status = 'COMPLETED' THEN now() END WHERE id = $1`,
        [jobId, nextStatus],
      );
      if (job.status === 'IN_PROGRESS') {
        await client.query(
          `UPDATE machines SET status = 'IDLE', status_changed_at = now() WHERE id = $1 AND status = 'RUNNING'`,
          [job.machine_id],
        );
      }
    } else if (action === 'reassign') {
      if (job.status === 'IN_PROGRESS') throw conflict('Hold the job before moving it to another machine.');
      const { rows: targetRows } = await client.query('SELECT stage FROM machines WHERE id = $1', [machineId]);
      if (!targetRows[0]) throw notFound('Machine');
      if (targetRows[0].stage !== job.stage) throw conflict('The new machine must be for the same stage.');
      await client.query('UPDATE production_jobs SET machine_id = $2 WHERE id = $1', [jobId, machineId]);
    }

    await refreshOrderStatus(client, job.order_id, { userId: request.user.id, note: `${job.job_number} ${action}` });
    await recordAudit(client, { request, action: `JOB_${action.toUpperCase()}`, entityType: 'production_job', entityId: jobId, details: { machineId } });
    const { rows: updated } = await client.query('SELECT * FROM production_jobs WHERE id = $1', [jobId]);
    return updated[0];
  });
}

// ---------------------------------------------------------------- output logging

export async function logProduction(request, { productionJobId, workerId, shiftId, quantityProduced, hoursWorked }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT j.id, j.order_id, j.machine_id, j.status, j.job_number, m.hourly_running_cost
         FROM production_jobs j JOIN machines m ON m.id = j.machine_id
        WHERE j.id = $1 FOR UPDATE OF j`,
      [productionJobId],
    );
    const job = rows[0];
    if (!job) throw notFound('Job');
    if (job.status !== 'IN_PROGRESS') throw conflict('Output can only be logged against a running job.');

    let labourCost = 0;
    if (workerId) {
      const { rows: workerRows } = await client.query('SELECT daily_wage FROM workers WHERE id = $1 AND is_active', [workerId]);
      if (!workerRows[0]) throw notFound('Worker');
      labourCost = roundTo2((workerRows[0].daily_wage / STANDARD_SHIFT_HOURS) * hoursWorked);
    }
    const machineCost = roundTo2(job.hourly_running_cost * hoursWorked);

    const { rows: logRows } = await client.query(
      `INSERT INTO production_logs (production_job_id, machine_id, worker_id, shift_id, quantity_produced, hours_worked, labour_cost, machine_cost, logged_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [job.id, job.machine_id, workerId ?? null, shiftId ?? null, quantityProduced, hoursWorked, labourCost, machineCost, request.user.id],
    );
    await client.query('UPDATE production_jobs SET produced_quantity = produced_quantity + $2 WHERE id = $1', [job.id, quantityProduced]);
    return logRows[0];
  });
}

export async function listProductionLogs({ date, machineId }) {
  const { rows } = await query(
    `SELECT pl.*, j.job_number, j.stage, j.quantity_unit, m.code AS machine_code, w.full_name AS worker_name,
            s.name AS shift_name, o.order_number
       FROM production_logs pl
       JOIN production_jobs j ON j.id = pl.production_job_id
       JOIN machines m ON m.id = pl.machine_id
       JOIN orders o ON o.id = j.order_id
       LEFT JOIN workers w ON w.id = pl.worker_id
       LEFT JOIN shifts s ON s.id = pl.shift_id
      WHERE pl.logged_at >= COALESCE($1::date, CURRENT_DATE)
        AND pl.logged_at < COALESCE($1::date, CURRENT_DATE) + 1
        AND ($2::bigint IS NULL OR pl.machine_id = $2)
      ORDER BY pl.logged_at DESC
      LIMIT 500`,
    [date ?? null, machineId ?? null],
  );
  return rows;
}
