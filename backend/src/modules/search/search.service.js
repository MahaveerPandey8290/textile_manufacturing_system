import { query } from '../../db/pool.js';
import { ROLES } from '../../constants/roles.js';
import { toLikePattern } from '../../utils/pagination.js';

const RESULTS_PER_GROUP = 5;

/**
 * Command-bar search across the mill. Backed by pg_trgm GIN indexes, so ILIKE '%term%' stays fast;
 * the pool's statement_timeout (7s) cancels anything slower, and the client debounces + cancels stale calls.
 */
export async function searchEverything(user, term) {
  const pattern = toLikePattern(term);
  if (user.role === ROLES.BUYER) {
    const { rows } = await query(
      `SELECT 'order' AS kind, id, order_number AS title, status AS subtitle FROM orders
        WHERE buyer_id = $2 AND order_number ILIKE $1 ORDER BY created_at DESC LIMIT ${RESULTS_PER_GROUP}`,
      [pattern, user.buyerId],
    );
    return rows;
  }
  const { rows } = await query(
    `(SELECT 'order' AS kind, o.id, o.order_number AS title, b.company_name || ' · ' || o.status AS subtitle
        FROM orders o JOIN buyers b ON b.id = o.buyer_id
       WHERE o.order_number ILIKE $1 OR b.company_name ILIKE $1 ORDER BY o.created_at DESC LIMIT ${RESULTS_PER_GROUP})
     UNION ALL
     (SELECT 'roll', r.id, r.roll_number, r.length_meters || ' m · ' || r.status
        FROM fabric_rolls r WHERE r.roll_number ILIKE $1 ORDER BY r.created_at DESC LIMIT ${RESULTS_PER_GROUP})
     UNION ALL
     (SELECT 'buyer', id, company_name, COALESCE(contact_person, '') FROM buyers
       WHERE company_name ILIKE $1 ORDER BY company_name LIMIT ${RESULTS_PER_GROUP})
     UNION ALL
     (SELECT 'yarn', id, code || ' · ' || name, current_stock_kg || ' kg in stock' FROM yarn_types
       WHERE (code || ' ' || name || ' ' || colour) ILIKE $1 ORDER BY name LIMIT ${RESULTS_PER_GROUP})
     UNION ALL
     (SELECT 'worker', id, full_name, employee_code FROM workers
       WHERE (employee_code || ' ' || full_name) ILIKE $1 ORDER BY full_name LIMIT ${RESULTS_PER_GROUP})`,
    [pattern],
  );
  return rows;
}
