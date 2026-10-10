import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../constants/roles.js';
import { allowRoles } from '../../middleware/authentication.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { listQuerySchema } from '../../utils/pagination.js';
import * as qualityService from './quality.service.js';

export const qualityRouter = Router();
qualityRouter.use(allowRoles(ROLES.QUALITY_INSPECTOR, ROLES.PRODUCTION_MANAGER, ROLES.STORE_MANAGER, ROLES.ACCOUNTANT));

const idParams = z.object({ id: z.coerce.number().int().positive() });
const rollStatusSchema = z.enum(['PENDING_QC', 'PASSED', 'REWORK', 'REJECTED', 'DISPATCHED']);
const defectTypeSchema = z.enum(['HOLE', 'COLOUR_MISMATCH', 'UNEVEN_WEAVING', 'STAIN', 'BROKEN_YARN', 'WIDTH_VARIATION', 'OTHER']);

qualityRouter.get(
  '/rolls',
  validateRequest({
    query: listQuerySchema.extend({ status: rollStatusSchema.optional(), orderId: z.coerce.number().int().positive().optional() }),
  }),
  async (request, response) => response.json(await qualityService.listRolls(request.valid.query)),
);
qualityRouter.get('/rolls/:id', validateRequest({ params: idParams }), async (request, response) =>
  response.json(await qualityService.traceRoll(request.valid.params.id)),
);
qualityRouter.post(
  '/rolls',
  allowRoles(ROLES.PRODUCTION_MANAGER),
  validateRequest({
    body: z.object({
      orderId: z.number().int().positive(),
      machineId: z.number().int().positive(),
      productionJobId: z.number().int().positive().optional().nullable(),
      lengthMeters: z.number().positive().max(10_000),
      weightKg: z.number().positive().max(10_000).optional().nullable(),
      rackLocation: z.string().trim().max(30).optional().nullable(),
    }),
  }),
  async (request, response) => response.status(201).json(await qualityService.createRoll(request, request.valid.body)),
);

qualityRouter.post(
  '/inspections',
  allowRoles(ROLES.QUALITY_INSPECTOR),
  validateRequest({
    body: z
      .object({
        fabricRollId: z.number().int().positive(),
        result: z.enum(['PASS', 'REWORK', 'REJECT']),
        grade: z.enum(['A', 'B', 'C']).optional().nullable(),
        remarks: z.string().trim().max(500).optional().nullable(),
        defects: z
          .array(z.object({ defectType: defectTypeSchema, occurrences: z.number().int().positive().max(999), note: z.string().trim().max(200).optional() }))
          .max(20)
          .default([]),
      })
      .refine((inspection) => inspection.result !== 'PASS' || inspection.grade, {
        message: 'Give a grade to a passed roll.',
        path: ['grade'],
      })
      .refine((inspection) => inspection.result === 'PASS' || inspection.defects.length > 0 || inspection.remarks, {
        message: 'Record at least one defect or a remark for rework and rejections.',
        path: ['defects'],
      }),
  }),
  async (request, response) => response.status(201).json(await qualityService.inspectRoll(request, request.valid.body)),
);

qualityRouter.get(
  '/summary',
  validateRequest({ query: z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }) }),
  async (request, response) => response.json(await qualityService.getQualitySummary(request.valid.query)),
);
