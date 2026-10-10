// Buyers and suppliers share the same shape, so one service serves both tables.
import { query, withTransaction } from '../../db/pool.js';
import { recordAudit } from '../../utils/auditLog.js';
import { notFound } from '../../utils/httpError.js';
import { toLikePattern, toOffset, toPage } from '../../utils/pagination.js';

const PARTY_TABLES = Object.freeze({ buyer: 'buyers', supplier: 'suppliers' });
const PARTY_COLUMNS = 'id, company_name, contact_person, phone, email, gst_number, address, is_active, created_at';

function tableFor(partyKind) {
  const table = PARTY_TABLES[partyKind];
  if (!table) throw new Error(`Unknown party kind ${partyKind}`);
  return table;
}

export async function listParties(partyKind, { search, page, pageSize }) {
  const table = tableFor(partyKind);
  const balanceSql =
    partyKind === 'buyer'
      ? `(SELECT COALESCE(sum(total_amount - amount_paid), 0) FROM invoices i WHERE i.buyer_id = p.id) AS outstanding_amount,
         (SELECT count(*) FROM orders o WHERE o.buyer_id = p.id AND o.status NOT IN ('DISPATCHED', 'CANCELLED')) AS open_orders`
      : `(SELECT COALESCE(sum(total_amount - amount_paid), 0) FROM yarn_receipts r WHERE r.supplier_id = p.id) AS outstanding_amount,
         (SELECT max(received_at) FROM yarn_receipts r WHERE r.supplier_id = p.id) AS last_delivery_at`;
  const { rows } = await query(
    `SELECT ${PARTY_COLUMNS}, ${balanceSql}, count(*) OVER () AS total_count
       FROM ${table} p
      WHERE ($1 = '' OR p.company_name ILIKE $2 OR p.contact_person ILIKE $2 OR p.phone ILIKE $2)
      ORDER BY p.company_name
      LIMIT $3 OFFSET $4`,
    [search, toLikePattern(search), pageSize, toOffset({ page, pageSize })],
  );
  return toPage(rows, { page, pageSize });
}

export async function getParty(partyKind, partyId) {
  const { rows } = await query(`SELECT ${PARTY_COLUMNS} FROM ${tableFor(partyKind)} WHERE id = $1`, [partyId]);
  if (!rows[0]) throw notFound(partyKind === 'buyer' ? 'Buyer' : 'Supplier');
  return rows[0];
}

export async function createParty(request, partyKind, party) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO ${tableFor(partyKind)} (company_name, contact_person, phone, email, gst_number, address)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${PARTY_COLUMNS}`,
      [party.companyName, party.contactPerson, party.phone, party.email, party.gstNumber, party.address],
    );
    await recordAudit(client, { request, action: `${partyKind.toUpperCase()}_CREATED`, entityType: partyKind, entityId: rows[0].id });
    return rows[0];
  });
}

export async function updateParty(request, partyKind, partyId, party) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE ${tableFor(partyKind)} SET
         company_name = COALESCE($2, company_name), contact_person = COALESCE($3, contact_person),
         phone = COALESCE($4, phone), email = COALESCE($5, email), gst_number = COALESCE($6, gst_number),
         address = COALESCE($7, address), is_active = COALESCE($8, is_active)
       WHERE id = $1 RETURNING ${PARTY_COLUMNS}`,
      [partyId, party.companyName, party.contactPerson, party.phone, party.email, party.gstNumber, party.address, party.isActive],
    );
    if (!rows[0]) throw notFound(partyKind === 'buyer' ? 'Buyer' : 'Supplier');
    await recordAudit(client, { request, action: `${partyKind.toUpperCase()}_UPDATED`, entityType: partyKind, entityId: partyId });
    return rows[0];
  });
}
