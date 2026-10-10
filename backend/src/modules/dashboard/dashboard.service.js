import { query } from '../../db/pool.js';
import { ROLES } from '../../constants/roles.js';

const FINANCE_VIEWERS = new Set([ROLES.OWNER, ROLES.ACCOUNTANT]);

/** One call that feeds the home dashboard; each role only receives the sections it is allowed to see. */
export async function getDashboard(user) {
  if (user.role === ROLES.BUYER) return getBuyerDashboard(user.buyerId);

  const sections = await Promise.all([
    query(
      `SELECT count(*) FILTER (WHERE status NOT IN ('DISPATCHED', 'CANCELLED')) AS open_orders,
              count(*) FILTER (WHERE status NOT IN ('DISPATCHED', 'CANCELLED') AND due_date < CURRENT_DATE) AS overdue_orders,
              count(*) FILTER (WHERE status NOT IN ('DISPATCHED', 'CANCELLED') AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7) AS due_this_week,
              count(*) FILTER (WHERE status = 'READY_TO_DISPATCH') AS ready_to_dispatch,
              (SELECT COALESCE(json_object_agg(status, status_count), '{}')
                 FROM (SELECT status, count(*) AS status_count FROM orders GROUP BY status) grouped) AS by_status
         FROM orders`,
    ),
    query(`SELECT status, count(*) AS machine_count FROM machines GROUP BY status`),
    query(
      `SELECT j.stage, j.quantity_unit, COALESCE(sum(pl.quantity_produced), 0) AS quantity
         FROM production_logs pl JOIN production_jobs j ON j.id = pl.production_job_id
        WHERE pl.logged_at >= date_trunc('day', now())
        GROUP BY j.stage, j.quantity_unit`,
    ),
    query(
      `SELECT d.day::date AS day, j.stage, COALESCE(sum(pl.quantity_produced), 0) AS quantity
         FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, interval '1 day') AS d(day)
         LEFT JOIN production_logs pl ON pl.logged_at >= d.day AND pl.logged_at < d.day + interval '1 day'
         LEFT JOIN production_jobs j ON j.id = pl.production_job_id
        GROUP BY d.day, j.stage ORDER BY d.day`,
    ),
    query(
      `SELECT (SELECT count(*) FROM fabric_rolls WHERE status IN ('PENDING_QC', 'REWORK')) AS rolls_waiting_qc,
              (SELECT COALESCE(sum(length_meters), 0) FROM fabric_rolls WHERE status = 'PASSED') AS finished_meters_on_shelf,
              (SELECT round(100.0 * count(*) FILTER (WHERE result = 'PASS') / NULLIF(count(*), 0), 1)
                 FROM quality_inspections WHERE inspected_at >= now() - interval '30 days') AS pass_rate_30_days`,
    ),
    query(
      `SELECT id, code, name, colour, current_stock_kg, reorder_level_kg
         FROM yarn_types WHERE current_stock_kg <= reorder_level_kg
        ORDER BY current_stock_kg / NULLIF(reorder_level_kg, 0) NULLS FIRST LIMIT 6`,
    ),
    query(
      `SELECT o.id, o.order_number, o.due_date, o.status, o.priority, o.quantity_meters, b.company_name AS buyer_name,
              p.passed_meters, p.produced_meters
         FROM orders o JOIN buyers b ON b.id = o.buyer_id JOIN order_progress p ON p.order_id = o.id
        WHERE o.status NOT IN ('DISPATCHED', 'CANCELLED') AND o.due_date <= CURRENT_DATE + 10
        ORDER BY o.due_date LIMIT 8`,
    ),
  ]);
  const [orders, machines, todayOutput, trend, quality, lowStock, upcomingDeliveries] = sections.map((result) => result.rows);

  const dashboard = {
    orders: orders[0],
    machines: Object.fromEntries(machines.map((row) => [row.status, row.machine_count])),
    todayOutput,
    productionTrend: trend,
    quality: quality[0],
    lowStockYarns: lowStock,
    upcomingDeliveries,
  };

  if (FINANCE_VIEWERS.has(user.role)) {
    const { rows } = await query(
      `SELECT (SELECT COALESCE(sum(total_amount - amount_paid), 0) FROM invoices) AS receivables,
              (SELECT COALESCE(sum(total_amount - amount_paid), 0) FROM invoices WHERE status <> 'PAID' AND due_date < CURRENT_DATE) AS overdue_receivables,
              (SELECT COALESCE(sum(total_amount - amount_paid), 0) FROM yarn_receipts) AS payables,
              (SELECT COALESCE(sum(subtotal), 0) FROM invoices WHERE invoice_date >= date_trunc('month', CURRENT_DATE)) AS revenue_this_month,
              (SELECT COALESCE(sum(amount), 0) FROM buyer_payments WHERE paid_on >= date_trunc('month', CURRENT_DATE)) AS collections_this_month`,
    );
    dashboard.finance = rows[0];
  }
  if (user.role === ROLES.OWNER) {
    const { rows } = await query(
      `SELECT a.action, a.entity_type, a.details, a.created_at, u.full_name AS user_name
         FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC LIMIT 8`,
    );
    dashboard.recentActivity = rows;
  }
  return dashboard;
}

async function getBuyerDashboard(buyerId) {
  const { rows } = await query(
    `SELECT count(*) FILTER (WHERE o.status NOT IN ('DISPATCHED', 'CANCELLED')) AS open_orders,
            count(*) FILTER (WHERE o.status = 'READY_TO_DISPATCH') AS ready_to_dispatch,
            count(*) FILTER (WHERE o.status IN ('DISPATCHED', 'PARTIALLY_DISPATCHED')) AS shipped_orders,
            (SELECT COALESCE(sum(total_amount - amount_paid), 0) FROM invoices WHERE buyer_id = $1) AS amount_due
       FROM orders o WHERE o.buyer_id = $1`,
    [buyerId],
  );
  return { buyer: rows[0] };
}
