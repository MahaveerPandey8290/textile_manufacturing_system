import { query } from '../../db/pool.js';
import { roundTo2 } from '../../utils/money.js';

const HOURS_PER_DAY = 24;

/** Month-end view for the owner: accrual profit and actual cash in / out. */
export async function getMonthlyProfitAndLoss({ month }) {
  const periodStart = `${month}-01`;
  const { rows } = await query(
    `WITH period AS (SELECT $1::date AS starts_on, ($1::date + interval '1 month')::date AS ends_on)
     SELECT
       (SELECT COALESCE(sum(subtotal), 0) FROM invoices, period WHERE invoice_date >= starts_on AND invoice_date < ends_on) AS revenue,
       (SELECT COALESCE(sum(-quantity_kg * cost_per_kg), 0) FROM yarn_stock_movements, period
         WHERE movement_type IN ('ISSUE', 'RETURN') AND created_at >= starts_on AND created_at < ends_on) AS yarn_consumed_cost,
       (SELECT COALESCE(sum(machine_cost), 0) FROM production_logs, period WHERE logged_at >= starts_on AND logged_at < ends_on) AS machine_running_cost,
       (SELECT total_net_pay FROM payroll_runs, period WHERE period_month = starts_on) AS payroll_wages,
       (SELECT COALESCE(sum(labour_cost), 0) FROM production_logs, period WHERE logged_at >= starts_on AND logged_at < ends_on) AS logged_labour_cost,
       (SELECT COALESCE(sum(total_amount), 0) FROM yarn_receipts, period WHERE received_at >= starts_on AND received_at < ends_on) AS yarn_purchased,
       (SELECT COALESCE(sum(amount), 0) FROM buyer_payments, period WHERE paid_on >= starts_on AND paid_on < ends_on) AS cash_from_buyers,
       (SELECT COALESCE(sum(amount), 0) FROM supplier_payments, period WHERE paid_on >= starts_on AND paid_on < ends_on) AS cash_to_suppliers,
       (SELECT COALESCE(sum(total_net_pay), 0) FROM payroll_runs, period WHERE status = 'PAID' AND paid_on >= starts_on AND paid_on < ends_on) AS wages_paid`,
    [periodStart],
  );
  const figures = rows[0];
  // Until payroll is generated for the month, fall back to labour cost logged on the floor.
  const wages = figures.payroll_wages ?? figures.logged_labour_cost;
  const totalCost = roundTo2(figures.yarn_consumed_cost + figures.machine_running_cost + wages);
  const totalExpenses = totalCost;
  const invoicing = figures.revenue;
  const netCash = roundTo2(figures.cash_from_buyers - figures.cash_to_suppliers - figures.wages_paid);
  const expensesBreakdown = {
    yarnConsumed: figures.yarn_consumed_cost,
    machineRunning: figures.machine_running_cost,
    wages,
    wagesSource: figures.payroll_wages === null ? 'production logs (payroll not generated yet)' : 'payroll',
    total: totalExpenses,
  };
  return {
    month,
    revenue: figures.revenue,
    invoicing,
    costs: expensesBreakdown,
    expenses: expensesBreakdown,
    operatingProfit: roundTo2(figures.revenue - totalCost),
    profitMarginPercent: figures.revenue > 0 ? roundTo2(((figures.revenue - totalCost) / figures.revenue) * 100) : null,
    cash: {
      fromBuyers: figures.cash_from_buyers,
      toSuppliers: figures.cash_to_suppliers,
      wagesPaid: figures.wages_paid,
      net: netCash,
    },
    yarnPurchased: figures.yarn_purchased,
  };
}

/** What every order really cost versus what it earns. */
export async function getOrderCosting({ month }) {
  const { rows } = await query(
    `SELECT o.id, o.order_number, o.status, o.quantity_meters, o.rate_per_meter, b.company_name AS buyer_name,
            f.name AS fabric_name, p.dispatched_meters, p.passed_meters,
            c.material_cost, c.labour_cost, c.machine_cost, c.total_cost,
            c.total_cost AS expenses,
            round(o.quantity_meters * o.rate_per_meter, 2) AS order_value,
            CASE WHEN p.produced_meters > 0 THEN round(c.total_cost / p.produced_meters, 2) END AS cost_per_meter,
            round(o.quantity_meters * o.rate_per_meter - c.total_cost, 2) AS projected_margin
       FROM orders o
       JOIN buyers b ON b.id = o.buyer_id
       JOIN fabric_types f ON f.id = o.fabric_type_id
       JOIN order_progress p ON p.order_id = o.id
       JOIN order_costing c ON c.order_id = o.id
      WHERE o.status <> 'CANCELLED'
        AND ($1::date IS NULL OR (o.created_at < ($1::date + interval '1 month') AND o.updated_at >= $1::date))
      ORDER BY o.created_at DESC
      LIMIT 200`,
    [month ? `${month}-01` : null],
  );
  return rows;
}

/** Output, running hours, downtime and utilisation for every machine over a date range. */
export async function getMachineOutput({ from, to }) {
  const { rows } = await query(
    `WITH period AS (SELECT $1::date AS starts_on, ($2::date + 1) AS ends_on)
     SELECT m.id, m.code, m.name, m.stage, m.status,
            COALESCE(output.quantity, 0) AS quantity_produced,
            CASE m.stage WHEN 'SPINNING' THEN 'kg' ELSE 'm' END AS quantity_unit,
            COALESCE(output.hours, 0) AS hours_run,
            COALESCE(output.machine_cost, 0) AS running_cost,
            COALESCE(downtime.hours, 0) AS downtime_hours,
            downtime.events AS breakdown_count,
            round(LEAST(100, 100 * COALESCE(output.hours, 0) / ((period.ends_on - period.starts_on) * ${HOURS_PER_DAY}))::numeric, 1) AS utilisation_percent
       FROM machines m
       CROSS JOIN period
       LEFT JOIN LATERAL (
         SELECT sum(quantity_produced) AS quantity, sum(hours_worked) AS hours, sum(machine_cost) AS machine_cost
           FROM production_logs pl WHERE pl.machine_id = m.id AND pl.logged_at >= period.starts_on AND pl.logged_at < period.ends_on
       ) output ON true
       LEFT JOIN LATERAL (
         SELECT count(*) AS events,
                round(sum(extract(epoch FROM (LEAST(COALESCE(d.ended_at, now()), period.ends_on::timestamptz)
                                         - GREATEST(d.started_at, period.starts_on::timestamptz))) / 3600)::numeric, 1) AS hours
           FROM machine_downtimes d
          WHERE d.machine_id = m.id AND d.started_at < period.ends_on AND COALESCE(d.ended_at, now()) > period.starts_on
       ) downtime ON true
      ORDER BY m.stage, m.code`,
    [from, to],
  );
  return rows;
}

export async function getWageSummary({ month }) {
  const { rows } = await query(
    `SELECT w.department, count(DISTINCT s.worker_id) AS workers, sum(s.days_present) AS days_worked,
            sum(s.overtime_hours) AS overtime_hours, sum(s.net_pay) AS net_pay
       FROM payslips s
       JOIN payroll_runs p ON p.id = s.payroll_run_id
       JOIN workers w ON w.id = s.worker_id
      WHERE p.period_month = $1::date
      GROUP BY w.department ORDER BY net_pay DESC`,
    [`${month}-01`],
  );
  return rows;
}
