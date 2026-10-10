import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../constants/roles.js';
import { allowRoles } from '../../middleware/authentication.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { listQuerySchema } from '../../utils/pagination.js';
import * as ordersService from './orders.service.js';

export const ordersRouter = Router();

const idParams = z.object({ id: z.coerce.number().int().positive() });
const orderStatusSchema = z.enum([
  'NEW', 'IN_PRODUCTION', 'QUALITY_CHECK', 'READY_TO_DISPATCH', 'PARTIALLY_DISPATCHED', 'DISPATCHED', 'CANCELLED',
]);
const prioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD.');
const orderWriters = [ROLES.PRODUCTION_MANAGER, ROLES.ACCOUNTANT];

ordersRouter.get(
  '/',
  validateRequest({
    query: listQuerySchema.extend({
      status: orderStatusSchema.optional(),
      buyerId: z.coerce.number().int().positive().optional(),
    }),
  }),
  async (request, response) => response.json(await ordersService.listOrders(request.user, request.valid.query)),
);

ordersRouter.get('/:id', validateRequest({ params: idParams }), async (request, response) =>
  response.json(await ordersService.getOrderDetail(request.user, request.valid.params.id)),
);

ordersRouter.post(
  '/',
  allowRoles(...orderWriters),
  validateRequest({
    body: z.object({
      buyerId: z.number().int().positive(),
      fabricTypeId: z.number().int().positive(),
      colour: z.string().trim().min(2).max(60),
      quantityMeters: z.number().positive().max(10_000_000),
      ratePerMeter: z.number().min(0).max(100_000),
      dueDate: isoDate,
      priority: prioritySchema.default('NORMAL'),
      notes: z.string().trim().max(1000).optional().nullable(),
    }),
  }),
  async (request, response) => response.status(201).json(await ordersService.createOrder(request, request.valid.body)),
);

ordersRouter.patch(
  '/:id',
  allowRoles(...orderWriters),
  validateRequest({
    params: idParams,
    body: z.object({
      dueDate: isoDate.optional(),
      priority: prioritySchema.optional(),
      notes: z.string().trim().max(1000).optional(),
      ratePerMeter: z.number().min(0).max(100_000).optional(),
    }),
  }),
  async (request, response) =>
    response.json(await ordersService.updateOrder(request, request.valid.params.id, request.valid.body)),
);

ordersRouter.post(
  '/:id/cancel',
  allowRoles(...orderWriters),
  validateRequest({ params: idParams, body: z.object({ reason: z.string().trim().min(3).max(300) }) }),
  async (request, response) =>
    response.json(await ordersService.cancelOrder(request, request.valid.params.id, request.valid.body.reason)),
);
