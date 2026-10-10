import { z } from 'zod';

export const MAX_PAGE_SIZE = 100;

/** Shared query-string shape for every list endpoint. */
export const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional().default(''),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
});

export function toOffset({ page, pageSize }) {
  return (page - 1) * pageSize;
}

/** Rows fetched with `count(*) OVER () AS total_count` become a page envelope. */
export function toPage(rows, { page, pageSize }) {
  const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
  return {
    items: rows.map(({ total_count: _ignored, ...row }) => row),
    page,
    pageSize,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}

/** Escape LIKE wildcards so a user typing "%" searches for a literal percent sign. */
export function toLikePattern(search) {
  return `%${search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}
