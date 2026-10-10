import { Router } from 'express';
import * as dashboardService from './dashboard.service.js';

export const dashboardRouter = Router();
dashboardRouter.get('/', async (request, response) => response.json(await dashboardService.getDashboard(request.user)));
