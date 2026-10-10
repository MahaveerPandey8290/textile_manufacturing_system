import { config } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

// PostgreSQL error codes we translate into friendly messages.
const POSTGRES_QUERY_CANCELED = '57014';
const POSTGRES_UNIQUE_VIOLATION = '23505';
const POSTGRES_FOREIGN_KEY_VIOLATION = '23503';
const POSTGRES_CHECK_VIOLATION = '23514';

export function notFoundHandler(request, response) {
  response.status(404).json({ error: { message: `No route for ${request.method} ${request.path}` } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, request, response, _next) {
  if (error instanceof HttpError) {
    return response.status(error.statusCode).json({ error: { message: error.message, details: error.details } });
  }

  const isQueryTimeout = error.code === POSTGRES_QUERY_CANCELED || /Query read timeout/i.test(error.message ?? '');
  if (isQueryTimeout) {
    return response.status(504).json({
      error: { message: 'This request took too long and was stopped. Try narrowing your search or filters.' },
    });
  }
  if (error.code === POSTGRES_UNIQUE_VIOLATION) {
    return response.status(409).json({ error: { message: 'A record with these details already exists.', details: error.detail } });
  }
  if (error.code === POSTGRES_FOREIGN_KEY_VIOLATION) {
    return response.status(409).json({ error: { message: 'This record is linked to other data and cannot be changed this way.' } });
  }
  if (error.code === POSTGRES_CHECK_VIOLATION) {
    return response.status(400).json({ error: { message: 'A value is outside the allowed range.', details: error.constraint } });
  }
  if (error.type === 'entity.parse.failed') {
    return response.status(400).json({ error: { message: 'Request body is not valid JSON.' } });
  }

  console.error(`[${request.method} ${request.originalUrl}]`, error);
  response.status(500).json({
    error: { message: 'Something went wrong on our side.', ...(config.isProduction ? {} : { debug: error.message }) },
  });
}
