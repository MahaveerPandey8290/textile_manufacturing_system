import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../constants/roles.js';
import { allowRoles } from '../../middleware/authentication.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { listQuerySchema } from '../../utils/pagination.js';
import * as financeService from './finance.service.js';

export const financeRouter = Router();
const paymentMethodSchema = z.enum(['BANK_TRANSFER', 'UPI', 'CHEQUE', 'CASH']);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const paymentFields = {
  amount: z.number().positive().max(1_000_000_000),
  method: paymentMethodSchema,
  reference: z.string().trim().max(60).optional().nullable(),
  paidOn: isoDate.optional().nullable(),
};

// Buyers may see their own invoices; everything else is for the accounts team.
financeRouter.get(
  '/invoices',
  allowRoles(ROLES.ACCOUNTANT, ROLES.BUYER),
  validateRequest({ query: listQuerySchema.extend({ status: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID']).optional() }) }),
  async (request, response) => response.json(await financeService.listInvoices(request.user, request.valid.query)),
);
financeRouter.post(
  '/buyer-payments',
  allowRoles(ROLES.ACCOUNTANT),
  validateRequest({ body: z.object({ invoiceId: z.number().int().positive(), ...paymentFields }) }),
  async (request, response) => response.status(201).json(await financeService.recordBuyerPayment(request, request.valid.body)),
);
financeRouter.get(
  '/supplier-bills',
  allowRoles(ROLES.ACCOUNTANT),
  validateRequest({ query: listQuerySchema.extend({ unpaidOnly: z.stringbool().optional().default(false) }) }),
  async (request, response) => response.json(await financeService.listSupplierBills(request.valid.query)),
);
financeRouter.post(
  '/supplier-payments',
  allowRoles(ROLES.ACCOUNTANT),
  validateRequest({ body: z.object({ yarnReceiptId: z.number().int().positive(), ...paymentFields }) }),
  async (request, response) => response.status(201).json(await financeService.recordSupplierPayment(request, request.valid.body)),
);
