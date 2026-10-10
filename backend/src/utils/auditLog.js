/** Write an audit entry. Pass the transaction client so the entry commits or rolls back with the change. */
export async function recordAudit(client, { request, action, entityType, entityId = null, details = null }) {
  await client.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [request?.user?.id ?? null, action, entityType, entityId, details, request?.ip ?? null],
  );
}
