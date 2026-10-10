import { badRequest } from './httpError.js';

export const MAX_LOGO_BYTES = 512 * 1024;

// Identify the image from its first bytes rather than trusting the declared type.
// SVG is deliberately not accepted: it can carry scripts.
function detectImageType(buffer) {
  if (buffer.length > 8 && buffer.readUInt32BE(0) === 0x89504e47) return 'image/png';
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** Turn a `data:image/...;base64,` URL from the browser into { data, mimeType }, or throw a 400. */
export function parseLogoDataUrl(dataUrl) {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? '');
  if (!match) throw badRequest('Logo must be a PNG, JPG or WebP image.');
  const data = Buffer.from(match[2], 'base64');
  if (data.length > MAX_LOGO_BYTES) throw badRequest('Logo must be 512 KB or smaller.');
  const mimeType = detectImageType(data);
  if (!mimeType) throw badRequest('That file is not a valid PNG, JPG or WebP image.');
  return { data, mimeType };
}
