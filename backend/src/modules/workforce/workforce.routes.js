import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../constants/roles.js';
import { allowRoles } from '../../middleware/authentication.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { listQuerySchema } from '../../utils/pagination.js';
import * as workforceService from './workforce.service.js';

export const workforceRouter = Router();
workforceRouter.use(allowRoles(ROLES.PRODUCTION_MANAGER, ROLES.ACCOUNTANT));

const idParams = z.object({ id: z.coerce.number().int().positive() });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD.');
const departmentSchema = z.enum(['SPINNING', 'WEAVING', 'DYEING']).nullable().optional();
const workerFields = {
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(20).optional().nullable(),
  department: departmentSchema,
  designation: z.string().trim().min(2).max(60).default('Operator'),
  dailyWage: z.number().min(0).max(100_000),
};

workforceRouter.get(
  '/workers',
  validateRequest({ query: listQuerySchema.extend({ includeInactive: z.stringbool().optional().default(false) }) }),
  async (request, response) => response.json(await workforceService.listWorkers(request.valid.query)),
);
workforceRouter.post(
  '/workers',
  allowRoles(ROLES.PRODUCTION_MANAGER),
  validateRequest({
    body: z.object({ employeeCode: z.string().trim().min(2).max(20), joinedOn: isoDate.optional().nullable(), ...workerFields }),
  }),
  async (request, response) => response.status(201).json(await workforceService.createWorker(request, request.valid.body)),
);
workforceRouter.patch(
  '/workers/:id',
  allowRoles(ROLES.PRODUCTION_MANAGER),
  validateRequest({
    params: idParams,
    body: z.object({ ...workerFields, isActive: z.boolean() }).partial(),
  }),
  async (request, response) =>
    response.json(await workforceService.updateWorker(request, request.valid.params.id, request.valid.body)),
);

workforceRouter.get('/attendance', validateRequest({ query: z.object({ date: isoDate }) }), async (request, response) =>
  response.json(await workforceService.getAttendanceSheet(request.valid.query)),
);
workforceRouter.put(
  '/attendance',
  allowRoles(ROLES.PRODUCTION_MANAGER),
  validateRequest({
    body: z.object({
      date: isoDate,
      entries: z
        .array(
          z.object({
            workerId: z.number().int().positive(),
            status: z.enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE']),
            shiftId: z.number().int().positive().optional().nullable(),
            overtimeHours: z.number().min(0).max(12).optional(),
          }),
        )
        .min(1)
        .max(2000),
    }),
  }),
  async (request, response) => response.json(await workforceService.markAttendance(request, request.valid.body)),
);

workforceRouter.get('/payroll', async (_request, response) => response.json(await workforceService.listPayrollRuns()));
workforceRouter.get('/payroll/:id', validateRequest({ params: idParams }), async (request, response) =>
  response.json(await workforceService.getPayrollRun(request.valid.params.id)),
);
workforceRouter.post(
  '/payroll',
  allowRoles(ROLES.ACCOUNTANT),
  validateRequest({ body: z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use the format YYYY-MM.') }) }),
  async (request, response) => response.status(201).json(await workforceService.generatePayroll(request, request.valid.body)),
);
workforceRouter.post('/payroll/:id/mark-paid', allowRoles(ROLES.ACCOUNTANT), validateRequest({ params: idParams }), async (request, response) =>
  response.json(await workforceService.markPayrollPaid(request, request.valid.params.id)),
);
