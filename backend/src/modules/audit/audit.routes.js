import { Router } from 'express';
import { ROLES } from '../../constants/roles.js';
import { query } from '../../db/pool.js';
import { allowRoles } from '../../middleware/authentication.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { listQuerySchema, toLikePattern, toOffset, toPage } from '../../utils/pagination.js';

export const auditRouter = Router();
auditRouter.get('/', allowRoles(ROLES.OWNER), validateRequest({ query: listQuerySchema }), async (request, response) => {
  const { search, page, pageSize } = request.valid.query;
  const { rows } = await query(
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.details, a.ip_address, a.created_at, u.full_name AS user_name,
            count(*) OVER () AS total_count
       FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
      WHERE ($1 = '' OR a.action ILIKE $2 OR a.entity_type ILIKE $2 OR u.full_name ILIKE $2)
      ORDER BY a.created_at DESC
      LIMIT $3 OFFSET $4`,
    [search, toLikePattern(search), pageSize, toOffset({ page, pageSize })],
  );
  response.json(toPage(rows, { page, pageSize }));
});
