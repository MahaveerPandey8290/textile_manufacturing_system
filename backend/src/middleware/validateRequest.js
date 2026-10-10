import { badRequest } from '../utils/httpError.js';

/**
 * Validate and coerce request parts with zod schemas.
 * Parsed values land on `request.valid.{body,query,params}`; handlers never read raw input.
 */
export function validateRequest(schemas) {
  return (request, _response, next) => {
    request.valid = {};
    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(request[part] ?? {});
      if (!result.success) {
        const fieldErrors = result.error.issues.map((issue) => ({
          field: issue.path.join('.') || part,
          message: issue.message,
        }));
        return next(badRequest('Some fields need your attention.', fieldErrors));
      }
      request.valid[part] = result.data;
    }
    next();
  };
}
