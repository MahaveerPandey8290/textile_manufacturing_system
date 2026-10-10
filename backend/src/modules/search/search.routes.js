import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '../../middleware/validateRequest.js';
import * as searchService from './search.service.js';

export const searchRouter = Router();
searchRouter.get(
  '/',
  validateRequest({ query: z.object({ q: z.string().trim().min(2, 'Type at least 2 characters.').max(60) }) }),
  async (request, response) => response.json(await searchService.searchEverything(request.user, request.valid.query.q)),
);
