import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../constants/roles.js';
import { allowRoles } from '../../middleware/authentication.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import * as reportsService from './reports.service.js';

export const reportsRouter = Router();
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use the format YYYY-MM.');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const currentMonth = () => new Date().toISOString().slice(0, 7);

reportsRouter.get(
  '/profit-and-loss',
  allowRoles(ROLES.ACCOUNTANT),
  validateRequest({ query: z.object({ month: monthSchema.default(currentMonth) }) }),
  async (request, response) => response.json(await reportsService.getMonthlyProfitAndLoss(request.valid.query)),
);
reportsRouter.get(
  '/order-costing',
  allowRoles(ROLES.ACCOUNTANT, ROLES.PRODUCTION_MANAGER),
  validateRequest({ query: z.object({ month: monthSchema.optional() }) }),
  async (request, response) => response.json(await reportsService.getOrderCosting(request.valid.query)),
);
reportsRouter.get(
  '/machine-output',
  allowRoles(ROLES.PRODUCTION_MANAGER, ROLES.ACCOUNTANT),
  validateRequest({
    query: z
      .object({ from: isoDate, to: isoDate })
      .refine(({ from, to }) => from <= to, { message: '"from" must be on or before "to".' })
      .refine(({ from, to }) => (new Date(to) - new Date(from)) / 86_400_000 <= 366, { message: 'Pick a range of at most one year.' }),
  }),
  async (request, response) => response.json(await reportsService.getMachineOutput(request.valid.query)),
);
reportsRouter.get(
  '/wages',
  allowRoles(ROLES.ACCOUNTANT),
  validateRequest({ query: z.object({ month: monthSchema.default(currentMonth) }) }),
  async (request, response) => response.json(await reportsService.getWageSummary(request.valid.query)),
);
