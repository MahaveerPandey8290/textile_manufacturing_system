/**
 * Record something the super admin should be able to see (sign-ups, sign-ins, resets ...).
 * Pass a transaction client to commit the event with the change it describes, or `query`.
 */
export async function recordPlatformEvent(executor, { organizationId = null, eventType, actorEmail = null, details = null, ip = null }) {
  const run = typeof executor === 'function' ? executor : executor.query.bind(executor);
  await run(
    `INSERT INTO platform.platform_events (organization_id, event_type, actor_email, details, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [organizationId, eventType, actorEmail, details, ip],
  );
}
