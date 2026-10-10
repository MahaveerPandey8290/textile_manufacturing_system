import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { runInTenantSchema } from '../db/pool.js';
import { findOrganizationById } from '../modules/organizations/organizationRegistry.js';
import { forbidden, HttpError, unauthorized } from '../utils/httpError.js';

export const SESSION_SCOPES = Object.freeze({ TENANT: 'tenant', PLATFORM: 'platform' });

/** Decode the session cookie, or return null when there is none or it is invalid/expired. */
export function readSession(request) {
  const token = request.cookies?.[config.sessionCookieName];
  if (!token) return null;
  try {
    return jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

export function signSession(payload) {
  return jwt.sign(payload, config.JWT_SECRET, { algorithm: 'HS256', expiresIn: `${config.SESSION_HOURS}h` });
}

/**
 * Staff and buyers of one organisation. Attaches `request.user` and `request.organization`,
 * then runs the rest of the request inside that organisation's database schema.
 */
export async function requireTenantSession(request, _response, next) {
  const session = readSession(request);
  if (!session) throw unauthorized(request.cookies?.[config.sessionCookieName] ? 'Your session has expired. Please sign in again.' : undefined);
  if (session.scope !== SESSION_SCOPES.TENANT) throw forbidden('Platform admins manage organisations from the platform console.');

  const organization = await findOrganizationById(Number(session.org));
  if (!organization) throw unauthorized();
  if (organization.status !== 'ACTIVE') throw new HttpError(403, 'Your organisation has been suspended. Contact the platform team.');

  request.organization = organization;
  request.user = {
    id: Number(session.sub),
    role: session.role,
    buyerId: session.buyerId ?? null,
    fullName: session.name,
    email: session.email,
  };
  runInTenantSchema(organization.schema_name, next);
}

/** Super admins only. Platform routes never run inside a tenant schema. */
export function requirePlatformSession(request, _response, next) {
  const session = readSession(request);
  if (!session) throw unauthorized();
  if (session.scope !== SESSION_SCOPES.PLATFORM) throw forbidden();
  request.user = { id: Number(session.sub), role: 'SUPER_ADMIN', fullName: session.name, email: session.email };
  next();
}

/** Allow only the listed roles. OWNER is always allowed: the owner can see and do everything. */
export function allowRoles(...allowedRoles) {
  return (request, _response, next) => {
    const { role } = request.user ?? {};
    if (role === 'OWNER' || allowedRoles.includes(role)) return next();
    next(forbidden());
  };
}
