import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '../../middleware/validateRequest.js';
import { listQuerySchema } from '../../utils/pagination.js';
import * as platformService from './platform.service.js';

// Mounted behind requirePlatformSession: super admins only.
export const platformRouter = Router();

const idParams = z.object({ id: z.coerce.number().int().positive() });

platformRouter.get('/overview', async (_request, response) => {
  response.json(await platformService.getOverview());
});

platformRouter.get(
  '/organizations',
  validateRequest({ query: listQuerySchema.extend({ status: z.enum(['ACTIVE', 'SUSPENDED']).optional() }) }),
  async (request, response) => {
    response.json(await platformService.listOrganizations(request.valid.query));
  },
);

platformRouter.get('/organizations/:id', validateRequest({ params: idParams }), async (request, response) => {
  response.json(await platformService.getOrganization(request.valid.params.id));
});

platformRouter.patch(
  '/organizations/:id/status',
  validateRequest({
    params: idParams,
    body: z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']), reason: z.string().trim().max(300).optional() }),
  }),
  async (request, response) => {
    response.json(await platformService.setOrganizationStatus(request, request.valid.params.id, request.valid.body));
  },
);

platformRouter.get(
  '/events',
  validateRequest({
    query: listQuerySchema.extend({
      organizationId: z.coerce.number().int().positive().optional(),
      eventType: z.string().trim().regex(/^[A-Z_]{3,40}$/).optional(),
    }),
  }),
  async (request, response) => {
    response.json(await platformService.listEvents(request.valid.query));
  },
);
