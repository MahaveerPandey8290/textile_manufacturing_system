import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../constants/roles.js';
import { allowRoles } from '../../middleware/authentication.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { listQuerySchema } from '../../utils/pagination.js';
import { workEmailSchema } from '../auth/auth.schemas.js';
import * as usersService from './users.service.js';

export const usersRouter = Router();
usersRouter.use(allowRoles(ROLES.OWNER));

const idParams = z.object({ id: z.coerce.number().int().positive() });
const roleSchema = z.enum(Object.values(ROLES));

usersRouter.get('/', validateRequest({ query: listQuerySchema }), async (request, response) => {
  response.json(await usersService.listUsers(request.valid.query));
});

usersRouter.post(
  '/',
  validateRequest({
    body: z.object({
      fullName: z.string().trim().min(2).max(120),
      email: workEmailSchema,
      role: roleSchema,
      buyerId: z.number().int().positive().optional(),
    }),
  }),
  async (request, response) => {
    response.status(201).json(await usersService.createUser(request, request.valid.body));
  },
);

usersRouter.patch(
  '/:id',
  validateRequest({
    params: idParams,
    body: z.object({
      fullName: z.string().trim().min(2).max(120).optional(),
      role: roleSchema.optional(),
      buyerId: z.number().int().positive().nullable().optional(),
      isActive: z.boolean().optional(),
    }),
  }),
  async (request, response) => {
    response.json(await usersService.updateUser(request, request.valid.params.id, request.valid.body));
  },
);
