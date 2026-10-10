import { query, withTransaction } from '../../db/pool.js';
import { ROLES } from '../../constants/roles.js';
import { recordAudit } from '../../utils/auditLog.js';
import { conflict, notFound } from '../../utils/httpError.js';
import { roundTo2 } from '../../utils/money.js';
import { toLikePattern, toOffset, toPage } from '../../utils/pagination.js';

export async function listInvoices(user, { search, page, pageSize, status }) {
  const buyerScope = user.role === ROLES.BUYER ? user.buyerId : null;
  const { rows } = await query(
    `SELECT i.id, i.invoice_number, i.invoice_date, i.due_date, i.total_meters, i.subtotal, i.tax_amount,
            i.total_amount, i.amount_paid, (i.total_amount - i.amount_paid) AS balance_due, i.status,
            (i.status <> 'PAID' AND i.due_date < CURRENT_DATE) AS is_overdue,
            o.order_number, b.company_name AS buyer_name, d.id AS dispatch_id,
            count(*) OVER () AS total_count
       FROM invoices i
       JOIN orders o ON o.id = i.order_id
       JOIN buyers b ON b.id = i.buyer_id
       LEFT JOIN dispatches d ON d.invoice_id = i.id
      WHERE ($1 = '' OR i.invoice_number ILIKE $2 OR o.order_number ILIKE $2 OR b.company_name ILIKE $2)
        AND ($3::invoice_status IS NULL OR i.status = $3)
        AND ($4::bigint IS NULL OR i.buyer_id = $4)
      ORDER BY (i.status = 'PAID'), i.due_date
      LIMIT $5 OFFSET $6`,
    [search, toLikePattern(search), status ?? null, buyerScope, pageSize, toOffset({ page, pageSize })],
  );
  return toPage(rows, { page, pageSize });
}

export async function recordBuyerPayment(request, { invoiceId, amount, method, reference, paidOn }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM invoices WHERE id = $1 FOR UPDATE', [invoiceId]);
    const invoice = rows[0];
    if (!invoice) throw notFound('Invoice');
    const balanceDue = roundTo2(invoice.total_amount - invoice.amount_paid);
    if (amount > balanceDue) throw conflict(`Payment is more than the balance due (₹${balanceDue}).`);

    await client.query(
      `INSERT INTO buyer_payments (invoice_id, buyer_id, amount, method, reference, paid_on, recorded_by)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), $7)`,
      [invoiceId, invoice.buyer_id, amount, method, reference ?? null, paidOn ?? null, request.user.id],
    );
    const newPaid = roundTo2(invoice.amount_paid + amount);
    const newStatus = newPaid >= invoice.total_amount ? 'PAID' : 'PARTIALLY_PAID';
    const { rows: updated } = await client.query(
      'UPDATE invoices SET amount_paid = $2, status = $3 WHERE id = $1 RETURNING *',
      [invoiceId, newPaid, newStatus],
    );
    await recordAudit(client, { request, action: 'BUYER_PAYMENT_RECORDED', entityType: 'invoice', entityId: invoiceId, details: { amount, method } });
    return updated[0];
  });
}

export async function listSupplierBills({ search, page, pageSize, unpaidOnly }) {
  const { rows } = await query(
    `SELECT r.id, r.receipt_number, r.bill_number, r.received_at, r.total_amount, r.amount_paid,
            (r.total_amount - r.amount_paid) AS balance_due, s.company_name AS supplier_name,
            count(*) OVER () AS total_count
       FROM yarn_receipts r JOIN suppliers s ON s.id = r.supplier_id
      WHERE ($1 = '' OR r.receipt_number ILIKE $2 OR r.bill_number ILIKE $2 OR s.company_name ILIKE $2)
        AND (NOT $3 OR r.amount_paid < r.total_amount)
      ORDER BY (r.amount_paid >= r.total_amount), r.received_at
      LIMIT $4 OFFSET $5`,
    [search, toLikePattern(search), unpaidOnly, pageSize, toOffset({ page, pageSize })],
  );
  return toPage(rows, { page, pageSize });
}

export async function recordSupplierPayment(request, { yarnReceiptId, amount, method, reference, paidOn }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM yarn_receipts WHERE id = $1 FOR UPDATE', [yarnReceiptId]);
    const bill = rows[0];
    if (!bill) throw notFound('Supplier bill');
    const balanceDue = roundTo2(bill.total_amount - bill.amount_paid);
    if (amount > balanceDue) throw conflict(`Payment is more than the balance due (₹${balanceDue}).`);

    await client.query(
      `INSERT INTO supplier_payments (yarn_receipt_id, supplier_id, amount, method, reference, paid_on, recorded_by)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), $7)`,
      [yarnReceiptId, bill.supplier_id, amount, method, reference ?? null, paidOn ?? null, request.user.id],
    );
    const { rows: updated } = await client.query(
      'UPDATE yarn_receipts SET amount_paid = amount_paid + $2 WHERE id = $1 RETURNING *',
      [yarnReceiptId, amount],
    );
    await recordAudit(client, { request, action: 'SUPPLIER_PAYMENT_RECORDED', entityType: 'yarn_receipt', entityId: yarnReceiptId, details: { amount, method } });
    return updated[0];
  });
}
