import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../constants/roles.js';
import { allowRoles } from '../../middleware/authentication.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { listQuerySchema } from '../../utils/pagination.js';
import * as dispatchService from './dispatch.service.js';

export const dispatchRouter = Router();
const idParams = z.object({ id: z.coerce.number().int().positive() });
const warehouseRoles = [ROLES.STORE_MANAGER, ROLES.PRODUCTION_MANAGER, ROLES.ACCOUNTANT];

dispatchRouter.get('/finished-stock', allowRoles(...warehouseRoles), async (_request, response) =>
  response.json(await dispatchService.getFinishedGoodsStock()),
);
dispatchRouter.get('/', validateRequest({ query: listQuerySchema }), async (request, response) =>
  response.json(await dispatchService.listDispatches(request.user, request.valid.query)),
);
dispatchRouter.get('/:id', validateRequest({ params: idParams }), async (request, response) =>
  response.json(await dispatchService.getDispatchDocument(request.user, request.valid.params.id)),
);
dispatchRouter.post(
  '/',
  allowRoles(ROLES.STORE_MANAGER),
  validateRequest({
    body: z.object({
      orderId: z.number().int().positive(),
      rollIds: z.array(z.number().int().positive()).min(1, 'Pick at least one roll.').max(500),
      vehicleNumber: z.string().trim().min(4, 'Enter the truck number.').max(20),
      driverName: z.string().trim().max(80).optional().nullable(),
      driverPhone: z.string().trim().max(20).optional().nullable(),
    }),
  }),
  async (request, response) => response.status(201).json(await dispatchService.createDispatch(request, request.valid.body)),
);
