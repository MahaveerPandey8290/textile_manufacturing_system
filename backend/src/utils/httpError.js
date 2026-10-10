/** An error that carries an HTTP status and a message that is safe to show to the user. */
export class HttpError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const unauthorized = (message = 'Please sign in to continue.') => new HttpError(401, message);
export const forbidden = (message = 'You do not have permission to do this.') => new HttpError(403, message);
export const notFound = (what = 'Record') => new HttpError(404, `${what} not found.`);
export const conflict = (message) => new HttpError(409, message);
