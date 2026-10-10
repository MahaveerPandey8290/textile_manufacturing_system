// Buyers can open a tracking link (no login) instead of calling the mill.
// The link carries an unguessable UUID; only non-sensitive fields are returned.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { query, runInTenantSchema } from '../../db/pool.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { notFound } from '../../utils/httpError.js';
import { organizationCodeSchema } from '../auth/auth.schemas.js';
import { findOrganizationByCode, toBranding } from '../organizations/organizationRegistry.js';

export const publicTrackingRouter = Router();
publicTrackingRouter.use(rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }));

const trackingParams = z.object({ organizationCode: organizationCodeSchema, trackingToken: z.uuid() });

publicTrackingRouter.get('/:organizationCode/:trackingToken', validateRequest({ params: trackingParams }), async (request, response) => {
  const organization = await findOrganizationByCode(request.valid.params.organizationCode);
  if (!organization || organization.status !== 'ACTIVE') throw notFound('Order');
  response.json(await runInTenantSchema(organization.schema_name, () => loadTrackedOrder(request.valid.params.trackingToken, organization)));
});

async function loadTrackedOrder(trackingToken, organization) {
  const { rows } = await query(
    `SELECT o.id, o.order_number, o.colour, o.quantity_meters, o.due_date, o.status, o.created_at,
            b.company_name AS buyer_name, f.name AS fabric_name,
            p.produced_meters, p.passed_meters, p.dispatched_meters
       FROM orders o
       JOIN buyers b ON b.id = o.buyer_id
       JOIN fabric_types f ON f.id = o.fabric_type_id
       JOIN order_progress p ON p.order_id = o.id
      WHERE o.tracking_token = $1`,
    [trackingToken],
  );
  const order = rows[0];
  if (!order) throw notFound('Order');
  const [timeline, dispatches] = await Promise.all([
    query('SELECT to_status, changed_at FROM order_status_history WHERE order_id = $1 ORDER BY changed_at, id', [order.id]),
    query('SELECT dispatch_number, total_rolls, total_meters, dispatched_at FROM dispatches WHERE order_id = $1 ORDER BY dispatched_at', [order.id]),
  ]);
  const { id: _internalId, ...publicOrder } = order;
  const { name, logoUrl } = toBranding(organization);
  return { ...publicOrder, mill: { name, logoUrl }, timeline: timeline.rows, dispatches: dispatches.rows };
}
