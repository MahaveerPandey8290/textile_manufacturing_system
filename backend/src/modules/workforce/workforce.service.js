import { query, withTransaction } from '../../db/pool.js';
import { recordAudit } from '../../utils/auditLog.js';
import { conflict, notFound } from '../../utils/httpError.js';
import { roundTo2 } from '../../utils/money.js';
import { toLikePattern, toOffset, toPage } from '../../utils/pagination.js';

const STANDARD_SHIFT_HOURS = 8;
const OVERTIME_MULTIPLIER = 1.5;
const DAY_CREDIT_BY_STATUS = Object.freeze({ PRESENT: 1, HALF_DAY: 0.5, ABSENT: 0, LEAVE: 0 });

// ---------------------------------------------------------------- workers

export async function listWorkers({ search, page, pageSize, includeInactive }) {
  const { rows } = await query(
    `SELECT w.*,
            (SELECT a.status FROM attendance_records a WHERE a.worker_id = w.id AND a.attendance_date = CURRENT_DATE) AS today_status,
            count(*) OVER () AS total_count
       FROM workers w
      WHERE ($1 = '' OR (w.employee_code || ' ' || w.full_name) ILIKE $2 OR w.phone ILIKE $2)
        AND ($5 OR w.is_active)
      ORDER BY w.full_name
      LIMIT $3 OFFSET $4`,
    [search, toLikePattern(search), pageSize, toOffset({ page, pageSize }), includeInactive],
  );
  return toPage(rows, { page, pageSize });
}

export async function createWorker(request, worker) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO workers (employee_code, full_name, phone, department, designation, daily_wage, joined_on)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::date, CURRENT_DATE)) RETURNING *`,
      [worker.employeeCode, worker.fullName, worker.phone ?? null, worker.department ?? null, worker.designation, worker.dailyWage, worker.joinedOn ?? null],
    );
    await recordAudit(client, { request, action: 'WORKER_CREATED', entityType: 'worker', entityId: rows[0].id });
    return rows[0];
  });
}

export async function updateWorker(request, workerId, changes) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE workers SET full_name = COALESCE($2, full_name), phone = COALESCE($3, phone),
              department = COALESCE($4, department), designation = COALESCE($5, designation),
              daily_wage = COALESCE($6, daily_wage), is_active = COALESCE($7, is_active)
        WHERE id = $1 RETURNING *`,
      [workerId, changes.fullName, changes.phone, changes.department, changes.designation, changes.dailyWage, changes.isActive],
    );
    if (!rows[0]) throw notFound('Worker');
    await recordAudit(client, { request, action: 'WORKER_UPDATED', entityType: 'worker', entityId: workerId, details: changes });
    return rows[0];
  });
}

// ---------------------------------------------------------------- attendance

/** The register for one day: every active worker with whatever was marked (or nothing yet). */
export async function getAttendanceSheet({ date }) {
  const { rows } = await query(
    `SELECT w.id AS worker_id, w.employee_code, w.full_name, w.department, w.designation,
            a.status, a.shift_id, a.overtime_hours
       FROM workers w
       LEFT JOIN attendance_records a ON a.worker_id = w.id AND a.attendance_date = $1
      WHERE w.is_active
      ORDER BY w.department NULLS LAST, w.full_name`,
    [date],
  );
  return rows;
}

export async function markAttendance(request, { date, entries }) {
  return withTransaction(async (client) => {
    const { rows: payrollRows } = await client.query(
      `SELECT status FROM payroll_runs WHERE period_month = date_trunc('month', $1::date)::date`,
      [date],
    );
    if (payrollRows[0]?.status === 'PAID') throw conflict('Wages for this month are already paid; attendance is locked.');

    // One statement for the whole register instead of one round trip per worker.
    await client.query(
      `INSERT INTO attendance_records (worker_id, attendance_date, shift_id, status, overtime_hours, marked_by)
       SELECT entry.worker_id, $1::date, entry.shift_id, entry.status::attendance_status, entry.overtime_hours, $3
         FROM jsonb_to_recordset($2::jsonb) AS entry(worker_id bigint, shift_id bigint, status text, overtime_hours numeric)
       ON CONFLICT (worker_id, attendance_date)
       DO UPDATE SET status = EXCLUDED.status, shift_id = EXCLUDED.shift_id,
                     overtime_hours = EXCLUDED.overtime_hours, marked_by = EXCLUDED.marked_by`,
      [
        date,
        JSON.stringify(
          entries.map((entry) => ({
            worker_id: entry.workerId,
            shift_id: entry.shiftId ?? null,
            status: entry.status,
            overtime_hours: entry.overtimeHours ?? 0,
          })),
        ),
        request.user.id,
      ],
    );
    await recordAudit(client, { request, action: 'ATTENDANCE_MARKED', entityType: 'attendance', details: { date, count: entries.length } });
    return { date, saved: entries.length };
  });
}

// ---------------------------------------------------------------- payroll

/** Builds (or rebuilds while still a draft) the month's payslips from attendance. */
export async function generatePayroll(request, { month }) {
  const periodMonth = `${month}-01`;
  return withTransaction(async (client) => {
    const { rows: existingRows } = await client.query('SELECT * FROM payroll_runs WHERE period_month = $1 FOR UPDATE', [periodMonth]);
    if (existingRows[0]?.status === 'PAID') throw conflict('This month is already paid and cannot be regenerated.');

    const { rows: runRows } = await client.query(
      `INSERT INTO payroll_runs (period_month, generated_by) VALUES ($1, $2)
       ON CONFLICT (period_month) DO UPDATE SET generated_at = now(), generated_by = EXCLUDED.generated_by
       RETURNING *`,
      [periodMonth, request.user.id],
    );
    const payrollRun = runRows[0];
    await client.query('DELETE FROM payslips WHERE payroll_run_id = $1', [payrollRun.id]);

    const { rows: attendance } = await client.query(
      `SELECT w.id AS worker_id, w.daily_wage,
              COALESCE(sum(CASE a.status WHEN 'PRESENT' THEN ${DAY_CREDIT_BY_STATUS.PRESENT}
                                         WHEN 'HALF_DAY' THEN ${DAY_CREDIT_BY_STATUS.HALF_DAY} ELSE 0 END), 0) AS days_present,
              COALESCE(sum(a.overtime_hours), 0) AS overtime_hours
         FROM workers w
         LEFT JOIN attendance_records a ON a.worker_id = w.id
              AND a.attendance_date >= $1::date AND a.attendance_date < ($1::date + interval '1 month')
        WHERE w.is_active OR a.id IS NOT NULL
        GROUP BY w.id`,
      [periodMonth],
    );

    let totalNetPay = 0;
    for (const record of attendance) {
      if (record.days_present === 0 && record.overtime_hours === 0) continue;
      const basicPay = roundTo2(record.days_present * record.daily_wage);
      const overtimePay = roundTo2((record.daily_wage / STANDARD_SHIFT_HOURS) * OVERTIME_MULTIPLIER * record.overtime_hours);
      const netPay = roundTo2(basicPay + overtimePay);
      totalNetPay += netPay;
      await client.query(
        `INSERT INTO payslips (payroll_run_id, worker_id, days_present, overtime_hours, daily_wage, basic_pay, overtime_pay, net_pay)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [payrollRun.id, record.worker_id, record.days_present, record.overtime_hours, record.daily_wage, basicPay, overtimePay, netPay],
      );
    }
    await client.query('UPDATE payroll_runs SET total_net_pay = $2 WHERE id = $1', [payrollRun.id, roundTo2(totalNetPay)]);
    await recordAudit(client, { request, action: 'PAYROLL_GENERATED', entityType: 'payroll_run', entityId: payrollRun.id, details: { month } });
    return getPayrollRun(payrollRun.id, client);
  });
}

export async function listPayrollRuns() {
  const { rows } = await query(
    `SELECT p.*, to_char(p.period_month, 'YYYY-MM') AS month, (SELECT count(*) FROM payslips s WHERE s.payroll_run_id = p.id) AS worker_count
       FROM payroll_runs p ORDER BY p.period_month DESC LIMIT 36`,
  );
  return rows;
}

export async function getPayrollRun(payrollRunId, client = { query }) {
  const { rows } = await client.query(
    `SELECT p.*, to_char(p.period_month, 'YYYY-MM') AS month FROM payroll_runs p WHERE p.id = $1`,
    [payrollRunId],
  );
  if (!rows[0]) throw notFound('Payroll');
  const { rows: payslips } = await client.query(
    `SELECT s.*, w.employee_code, w.full_name, w.department
       FROM payslips s JOIN workers w ON w.id = s.worker_id
      WHERE s.payroll_run_id = $1 ORDER BY w.full_name`,
    [payrollRunId],
  );
  return { ...rows[0], payslips };
}

export async function markPayrollPaid(request, payrollRunId) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE payroll_runs SET status = 'PAID', paid_on = CURRENT_DATE WHERE id = $1 AND status = 'DRAFT' RETURNING *`,
      [payrollRunId],
    );
    if (!rows[0]) throw conflict('Only a draft payroll can be marked as paid.');
    await recordAudit(client, { request, action: 'PAYROLL_PAID', entityType: 'payroll_run', entityId: payrollRunId, details: { total: rows[0].total_net_pay } });
    return rows[0];
  });
}
