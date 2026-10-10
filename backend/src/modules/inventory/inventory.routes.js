import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../constants/roles.js';
import { allowRoles } from '../../middleware/authentication.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { listQuerySchema } from '../../utils/pagination.js';
import * as inventoryService from './inventory.service.js';

export const inventoryRouter = Router();

const storeRoles = [ROLES.STORE_MANAGER, ROLES.PRODUCTION_MANAGER];
const idParams = z.object({ id: z.coerce.number().int().positive() });
const positiveQuantity = z.number().positive().max(1_000_000);
const optionalText = (max) => z.string().trim().max(max).optional().nullable();

inventoryRouter.use(allowRoles(ROLES.STORE_MANAGER, ROLES.PRODUCTION_MANAGER, ROLES.ACCOUNTANT));

// Yarn types and stock
inventoryRouter.get(
  '/yarn-types',
  validateRequest({ query: listQuerySchema.extend({ lowStockOnly: z.stringbool().optional().default(false) }) }),
  async (request, response) => response.json(await inventoryService.listYarnTypes(request.valid.query)),
);
inventoryRouter.post(
  '/yarn-types',
  allowRoles(...storeRoles),
  validateRequest({
    body: z.object({
      code: z.string().trim().min(2).max(30),
      name: z.string().trim().min(2).max(120),
      material: z.string().trim().min(2).max(60),
      yarnCount: z.string().trim().min(1).max(20),
      colour: z.string().trim().min(2).max(60),
      reorderLevelKg: z.number().min(0).max(1_000_000),
      costPerKg: z.number().min(0).optional(),
    }),
  }),
  async (request, response) => response.status(201).json(await inventoryService.createYarnType(request, request.valid.body)),
);
inventoryRouter.patch(
  '/yarn-types/:id',
  allowRoles(...storeRoles),
  validateRequest({
    params: idParams,
    body: z.object({
      name: z.string().trim().min(2).max(120).optional(),
      colour: z.string().trim().min(2).max(60).optional(),
      reorderLevelKg: z.number().min(0).max(1_000_000).optional(),
    }),
  }),
  async (request, response) =>
    response.json(await inventoryService.updateYarnType(request, request.valid.params.id, request.valid.body)),
);
inventoryRouter.get(
  '/yarn-types/:id/movements',
  validateRequest({ params: idParams, query: listQuerySchema }),
  async (request, response) =>
    response.json(await inventoryService.listStockMovements(request.valid.params.id, request.valid.query)),
);

// Fabric types (recipe: how much yarn one meter needs)
inventoryRouter.get('/fabric-types', async (_request, response) => response.json(await inventoryService.listFabricTypes()));
inventoryRouter.post(
  '/fabric-types',
  allowRoles(ROLES.PRODUCTION_MANAGER),
  validateRequest({
    body: z.object({
      name: z.string().trim().min(2).max(120),
      construction: optionalText(60),
      gsm: z.number().int().positive().max(2000).optional().nullable(),
      widthInches: z.number().positive().max(200).optional().nullable(),
      yarnTypeId: z.number().int().positive(),
      yarnKgPerMeter: z.number().positive().max(10),
    }),
  }),
  async (request, response) => response.status(201).json(await inventoryService.createFabricType(request, request.valid.body)),
);

// Gate entry: yarn arrives
inventoryRouter.get('/receipts', validateRequest({ query: listQuerySchema }), async (request, response) =>
  response.json(await inventoryService.listYarnReceipts(request.valid.query)),
);
inventoryRouter.post(
  '/receipts',
  allowRoles(ROLES.STORE_MANAGER),
  validateRequest({
    body: z.object({
      supplierId: z.number().int().positive(),
      orderId: z.number().int().positive().optional().nullable(),
      vehicleNumber: optionalText(20),
      challanNumber: optionalText(40),
      billNumber: optionalText(40),
      items: z
        .array(z.object({ yarnTypeId: z.number().int().positive(), quantityKg: positiveQuantity, costPerKg: z.number().min(0).max(100_000) }))
        .min(1, 'Add at least one yarn line.')
        .max(50),
    }),
  }),
  async (request, response) => response.status(201).json(await inventoryService.receiveYarn(request, request.valid.body)),
);

// Store issues yarn to the floor for an order
inventoryRouter.post(
  '/issues',
  allowRoles(...storeRoles),
  validateRequest({
    body: z.object({
      orderId: z.number().int().positive(),
      yarnTypeId: z.number().int().positive(),
      quantityKg: positiveQuantity,
      note: optionalText(200),
    }),
  }),
  async (request, response) => response.status(201).json(await inventoryService.issueYarnToOrder(request, request.valid.body)),
);

inventoryRouter.post(
  '/adjustments',
  allowRoles(ROLES.STORE_MANAGER),
  validateRequest({
    body: z.object({
      yarnTypeId: z.number().int().positive(),
      quantityKg: z.number().min(-1_000_000).max(1_000_000),
      note: z.string().trim().min(3, 'Explain why stock is being adjusted.').max(200),
    }),
  }),
  async (request, response) => response.status(201).json(await inventoryService.adjustYarnStock(request, request.valid.body)),
);

inventoryRouter.get(
  '/availability',
  validateRequest({
    query: z.object({
      fabricTypeId: z.coerce.number().int().positive(),
      quantityMeters: z.coerce.number().positive().max(10_000_000),
      orderId: z.coerce.number().int().positive().optional(),
    }),
  }),
  async (request, response) => response.json(await inventoryService.checkYarnAvailability(request.valid.query)),
);
