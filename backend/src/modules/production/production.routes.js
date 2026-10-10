import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../constants/roles.js';
import { allowRoles } from '../../middleware/authentication.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import * as productionService from './production.service.js';

export const productionRouter = Router();
productionRouter.use(allowRoles(ROLES.PRODUCTION_MANAGER, ROLES.QUALITY_INSPECTOR, ROLES.STORE_MANAGER, ROLES.ACCOUNTANT));
const floorRoles = [ROLES.PRODUCTION_MANAGER];

const idParams = z.object({ id: z.coerce.number().int().positive() });
const stageSchema = z.enum(['SPINNING', 'WEAVING', 'DYEING']);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

productionRouter.get('/machines', validateRequest({ query: z.object({ stage: stageSchema.optional() }) }), async (request, response) =>
  response.json(await productionService.getMachineBoard(request.valid.query)),
);
productionRouter.post(
  '/machines',
  allowRoles(...floorRoles),
  validateRequest({
    body: z.object({
      code: z.string().trim().min(2).max(20),
      name: z.string().trim().min(2).max(120),
      stage: stageSchema,
      hourlyRunningCost: z.number().min(0).max(100_000),
      location: z.string().trim().max(60).optional().nullable(),
    }),
  }),
  async (request, response) => response.status(201).json(await productionService.createMachine(request, request.valid.body)),
);
productionRouter.post(
  '/machines/:id/status',
  allowRoles(...floorRoles),
  validateRequest({
    params: idParams,
    body: z.object({
      status: z.enum(['RUNNING', 'IDLE', 'BREAKDOWN', 'MAINTENANCE']),
      reason: z.string().trim().max(300).optional(),
    }),
  }),
  async (request, response) =>
    response.json(await productionService.changeMachineStatus(request, request.valid.params.id, request.valid.body)),
);
productionRouter.get(
  '/downtimes',
  validateRequest({
    query: z.object({ machineId: z.coerce.number().int().positive().optional(), from: isoDate.optional(), to: isoDate.optional() }),
  }),
  async (request, response) => response.json(await productionService.listDowntimes(request.valid.query)),
);
productionRouter.get('/shifts', async (_request, response) => response.json(await productionService.listShifts()));

productionRouter.get(
  '/jobs',
  validateRequest({
    query: z.object({
      status: z.enum(['PLANNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED']).optional(),
      stage: stageSchema.optional(),
      orderId: z.coerce.number().int().positive().optional(),
    }),
  }),
  async (request, response) => response.json(await productionService.listJobs(request.valid.query)),
);
productionRouter.post(
  '/jobs',
  allowRoles(...floorRoles),
  validateRequest({
    body: z.object({
      orderId: z.number().int().positive(),
      stage: stageSchema,
      machineId: z.number().int().positive(),
      plannedQuantity: z.number().positive().max(10_000_000),
    }),
  }),
  async (request, response) => response.status(201).json(await productionService.createJob(request, request.valid.body)),
);
productionRouter.post(
  '/jobs/:id/:action',
  allowRoles(...floorRoles),
  validateRequest({
    params: idParams.extend({ action: z.enum(['start', 'hold', 'complete', 'reassign']) }),
    body: z.object({ machineId: z.number().int().positive().optional() }),
  }),
  async (request, response) => {
    const { id, action } = request.valid.params;
    if (action === 'reassign' && !request.valid.body.machineId) {
      return response.status(400).json({ error: { message: 'Choose the machine to move this job to.' } });
    }
    response.json(await productionService.changeJobState(request, id, { action, machineId: request.valid.body.machineId }));
  },
);

productionRouter.get(
  '/logs',
  validateRequest({ query: z.object({ date: isoDate.optional(), machineId: z.coerce.number().int().positive().optional() }) }),
  async (request, response) => response.json(await productionService.listProductionLogs(request.valid.query)),
);
productionRouter.post(
  '/logs',
  allowRoles(...floorRoles),
  validateRequest({
    body: z.object({
      productionJobId: z.number().int().positive(),
      workerId: z.number().int().positive().optional().nullable(),
      shiftId: z.number().int().positive().optional().nullable(),
      quantityProduced: z.number().positive().max(1_000_000),
      hoursWorked: z.number().positive().max(24),
    }),
  }),
  async (request, response) => response.status(201).json(await productionService.logProduction(request, request.valid.body)),
);
