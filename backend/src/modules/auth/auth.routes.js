import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../../config/env.js';
import { readSession } from '../../middleware/authentication.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { unauthorized } from '../../utils/httpError.js';
import * as organizationsService from '../organizations/organizations.service.js';
import * as authSchemas from './auth.schemas.js';
import * as authService from './auth.service.js';

export const authRouter = Router();

const limiter = (limit, windowMinutes, message) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Integration tests create many organisations and codes from one address.
    skip: () => config.NODE_ENV === 'test',
    message: { error: { message } },
  });

// Password guessing: 10 failed attempts per 15 minutes per IP.
const signInLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: { message: 'Too many sign-in attempts. Please wait a few minutes and try again.' } },
});
const signUpLimit = limiter(5, 60, 'Too many sign-ups from this network. Please try again later.');
const codeLimit = limiter(8, 15, 'Too many code requests. Please wait a few minutes and try again.');

const sessionCookieOptions = {
  httpOnly: true, // not readable from JavaScript, so XSS cannot steal the session
  sameSite: 'strict', // not sent on cross-site requests, which blocks CSRF
  secure: config.isProduction,
  path: '/',
};
const setSessionCookie = (response, token) =>
  response.cookie(config.sessionCookieName, token, { ...sessionCookieOptions, maxAge: config.SESSION_HOURS * 3600 * 1000 });

// ------------------------------------------------------------------ organisation sign-up
authRouter.post(
  '/organizations',
  signUpLimit,
  validateRequest({ body: authSchemas.organizationSignUpSchema }),
  async (request, response) => {
    const created = await organizationsService.registerOrganization(request.valid.body, { ip: request.ip });
    const { token, session } = await authService.sessionForNewOwner(created.organizationId, created.ownerId);
    setSessionCookie(response, token);
    response.status(201).json({ organizationCode: created.organizationCode, session });
  },
);

// ------------------------------------------------------------------ sign in
// Staff: organisation code + role + work email. Organisation admin: work email only. Super admin: platform.
authRouter.post('/login', signInLimit, validateRequest({ body: authSchemas.staffSignInSchema }), async (request, response) => {
  const { token, session } = await authService.signInStaff(request.valid.body, { ip: request.ip });
  setSessionCookie(response, token);
  response.json(session);
});

authRouter.post('/organization/login', signInLimit, validateRequest({ body: authSchemas.organizationAdminSignInSchema }), async (request, response) => {
  const { token, session } = await authService.signInOrganizationAdmin(request.valid.body, { ip: request.ip });
  setSessionCookie(response, token);
  response.json(session);
});

authRouter.post('/platform/login', signInLimit, validateRequest({ body: authSchemas.platformSignInSchema }), async (request, response) => {
  const { token, session } = await authService.signInPlatformAdmin(request.valid.body, { ip: request.ip });
  setSessionCookie(response, token);
  response.json(session);
});

authRouter.post('/logout', (_request, response) => {
  response.clearCookie(config.sessionCookieName, sessionCookieOptions);
  response.status(204).end();
});

authRouter.get('/me', async (request, response) => {
  const session = readSession(request);
  if (!session) throw unauthorized();
  response.json(await authService.getSession(session));
});

authRouter.post('/change-password', validateRequest({ body: authSchemas.changePasswordSchema }), async (request, response) => {
  const session = readSession(request);
  if (!session) throw unauthorized();
  await authService.changePassword(session, request.valid.body);
  response.status(204).end();
});

// ------------------------------------------------------------------ forgot password / first-time setup
authRouter.post('/password/request-code', codeLimit, validateRequest({ body: authSchemas.requestCodeSchema }), async (request, response) => {
  response.json(await authService.requestPasswordCode(request.valid.body, { ip: request.ip }));
});

authRouter.post('/password/verify-code', codeLimit, validateRequest({ body: authSchemas.verifyCodeSchema }), async (request, response) => {
  response.json(await authService.verifyPasswordCode(request.valid.body));
});

authRouter.post('/password/reset', codeLimit, validateRequest({ body: authSchemas.resetPasswordSchema }), async (request, response) => {
  response.json(await authService.resetPassword(request.valid.body, { ip: request.ip }));
});
