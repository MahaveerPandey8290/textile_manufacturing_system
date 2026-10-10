import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { ROLES } from '../../constants/roles.js';
import { allowRoles } from '../../middleware/authentication.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { organizationCodeSchema } from '../auth/auth.schemas.js';
import * as organizationsService from './organizations.service.js';

// ------------------------------------------------------------------ public: branding for the sign-in screens
export const publicOrganizationsRouter = Router();
publicOrganizationsRouter.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false }));

const codeParams = z.object({ organizationCode: organizationCodeSchema });

publicOrganizationsRouter.get('/:organizationCode', validateRequest({ params: codeParams }), async (request, response) => {
  response.json(await organizationsService.getBrandingByCode(request.valid.params.organizationCode));
});

publicOrganizationsRouter.get('/:organizationCode/logo', validateRequest({ params: codeParams }), async (request, response) => {
  const logo = await organizationsService.getLogo(request.valid.params.organizationCode);
  response.set({
    'Content-Type': logo.logo_mime_type,
    'Cache-Control': 'public, max-age=86400, immutable', // URLs carry ?v=<updated time>
    'Content-Security-Policy': "default-src 'none'",
  });
  response.send(logo.logo_data);
});

// ------------------------------------------------------------------ signed in: the organisation's own profile
export const organizationProfileRouter = Router();

organizationProfileRouter.get('/', async (request, response) => {
  response.json(await organizationsService.getProfile(request.organization.id));
});

organizationProfileRouter.patch(
  '/',
  allowRoles(ROLES.OWNER),
  validateRequest({
    body: z.object({
      name: z.string().trim().min(2).max(120).optional(),
      city: z.string().trim().min(2).max(80).optional(),
      phone: z.string().trim().max(20).regex(/^([+\d][\d\s-]{6,19})?$/, 'Enter a valid phone number.').optional(),
      gstNumber: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^(\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d])?$/, 'Enter a valid 15-character GSTIN.')
        .optional(),
      // A data URL to replace the logo, or null to remove it.
      logo: z.string().max(800_000).nullable().optional(),
    }),
  }),
  async (request, response) => {
    response.json(await organizationsService.updateProfile(request, request.organization.id, request.valid.body));
  },
);
