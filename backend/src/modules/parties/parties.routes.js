import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../constants/roles.js';
import { allowRoles } from '../../middleware/authentication.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { listQuerySchema } from '../../utils/pagination.js';
import * as partiesService from './parties.service.js';

const optionalText = (max) => z.string().trim().max(max).optional().nullable().transform((value) => value || null);

const partyBodySchema = z.object({
  companyName: z.string().trim().min(2, 'Company name is required.').max(160),
  contactPerson: optionalText(120),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{7,20}$/, 'Enter a valid phone number.')
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
  email: z.string().trim().email().optional().nullable().or(z.literal('').transform(() => null)),
  gstNumber: optionalText(20),
  address: optionalText(400),
});
const idParams = z.object({ id: z.coerce.number().int().positive() });

/** Builds the same CRUD router for buyers and suppliers. */
function buildPartyRouter(partyKind, writerRoles) {
  const router = Router();
  router.get('/', validateRequest({ query: listQuerySchema }), async (request, response) => {
    response.json(await partiesService.listParties(partyKind, request.valid.query));
  });
  router.get('/:id', validateRequest({ params: idParams }), async (request, response) => {
    response.json(await partiesService.getParty(partyKind, request.valid.params.id));
  });
  router.post('/', allowRoles(...writerRoles), validateRequest({ body: partyBodySchema }), async (request, response) => {
    response.status(201).json(await partiesService.createParty(request, partyKind, request.valid.body));
  });
  router.patch(
    '/:id',
    allowRoles(...writerRoles),
    validateRequest({ params: idParams, body: partyBodySchema.partial().extend({ isActive: z.boolean().optional() }) }),
    async (request, response) => {
      response.json(await partiesService.updateParty(request, partyKind, request.valid.params.id, request.valid.body));
    },
  );
  return router;
}

export const buyersRouter = buildPartyRouter('buyer', [ROLES.ACCOUNTANT, ROLES.PRODUCTION_MANAGER]);
export const suppliersRouter = buildPartyRouter('supplier', [ROLES.ACCOUNTANT, ROLES.STORE_MANAGER]);
