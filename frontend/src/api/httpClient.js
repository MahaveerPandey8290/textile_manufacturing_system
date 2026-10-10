// Thin fetch wrapper: JSON in/out, cookies included, friendly errors, and AbortSignal support
// so a newer search can cancel an older one that is still in flight.
export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const REQUEST_TIMEOUT_MS = 8000;

function buildUrl(path, params) {
  const url = new URL(`/api${path}`, window.location.origin);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  });
  return url;
}

export async function apiRequest(path, { method = 'GET', params, body, signal } = {}) {
  // Combine the caller's signal (React Query cancellation) with our own timeout.
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(new DOMException('Timed out', 'TimeoutError')), REQUEST_TIMEOUT_MS);
  signal?.addEventListener('abort', () => timeoutController.abort(signal.reason), { once: true });

  try {
    const response = await fetch(buildUrl(path, params), {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: timeoutController.signal,
    });
    if (response.status === 204) return null;
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('session-expired'));
      throw new ApiError(response.status, payload?.error?.message ?? 'Request failed.', payload?.error?.details);
    }
    return payload;
  } catch (error) {
    if (error.name === 'TimeoutError' || timeoutController.signal.reason?.name === 'TimeoutError') {
      throw new ApiError(504, 'The server is taking too long. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  get: (path, params, signal) => apiRequest(path, { params, signal }),
  post: (path, body) => apiRequest(path, { method: 'POST', body }),
  put: (path, body) => apiRequest(path, { method: 'PUT', body }),
  patch: (path, body) => apiRequest(path, { method: 'PATCH', body }),
};
