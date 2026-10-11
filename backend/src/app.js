import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { config } from './config/env.js';
import { STAFF_ROLES } from './constants/roles.js';
import { pool } from './db/pool.js';
import { allowRoles, requirePlatformSession, requireTenantSession } from './middleware/authentication.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { dispatchRouter } from './modules/dispatch/dispatch.routes.js';
import { financeRouter } from './modules/finance/finance.routes.js';
import { inventoryRouter } from './modules/inventory/inventory.routes.js';
import { ordersRouter } from './modules/orders/orders.routes.js';
import { organizationProfileRouter, publicOrganizationsRouter } from './modules/organizations/organizations.routes.js';
import { buyersRouter, suppliersRouter } from './modules/parties/parties.routes.js';
import { platformRouter } from './modules/platform/platform.routes.js';
import { productionRouter } from './modules/production/production.routes.js';
import { publicTrackingRouter } from './modules/publicTracking/publicTracking.routes.js';
import { qualityRouter } from './modules/quality/quality.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { searchRouter } from './modules/search/search.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { workforceRouter } from './modules/workforce/workforce.routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: config.CLIENT_ORIGIN.split(','), credentials: true }));
  app.use(compression());
  // Sign-up, organisation profile, and quality inspection photos carry images; everything else stays small.
  app.use(['/api/auth/organizations', '/api/organization', '/api/quality'], express.json({ limit: '1mb' }));
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());
  // A generous global ceiling; sensitive routes (login, public tracking) have tighter limits.
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false }));

  app.get('/api/health', async (_request, response) => {
    await pool.query('SELECT 1');
    response.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/public/track', publicTrackingRouter);
  app.use('/api/public/organizations', publicOrganizationsRouter);

  // Super admin console. Platform sessions can't reach organisation data below, and
  // organisation sessions can't reach this.
  app.use('/api/platform', requirePlatformSession, platformRouter);

  // Everything below belongs to one organisation and runs inside its database schema.
  const securedApi = Router();
  securedApi.use(requireTenantSession);
  securedApi.use('/organization', organizationProfileRouter);
  securedApi.use('/dashboard', dashboardRouter);
  securedApi.use('/search', searchRouter);
  securedApi.use('/orders', ordersRouter);
  securedApi.use('/dispatches', dispatchRouter);
  securedApi.use('/finance', financeRouter);
  // Staff-only areas
  securedApi.use('/users', usersRouter);
  securedApi.use('/buyers', allowRoles(...STAFF_ROLES), buyersRouter);
  securedApi.use('/suppliers', allowRoles(...STAFF_ROLES), suppliersRouter);
  securedApi.use('/inventory', inventoryRouter);
  securedApi.use('/production', productionRouter);
  securedApi.use('/quality', qualityRouter);
  securedApi.use('/workforce', workforceRouter);
  securedApi.use('/reports', reportsRouter);
  securedApi.use('/audit', auditRouter);
  app.use('/api', securedApi);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
