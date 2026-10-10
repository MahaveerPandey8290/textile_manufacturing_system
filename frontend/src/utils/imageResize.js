const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;

/**
 * Shrink a logo in the browser to at most `maxSize` px and return a PNG data URL.
 * Uploads stay tiny (well under the server's 512 KB limit) whatever the original was.
 */
export async function logoFileToDataUrl(file, maxSize = 256) {
  if (!ACCEPTED_TYPES.includes(file.type)) throw new Error('Choose a PNG, JPG or WebP image.');
  if (file.size > MAX_SOURCE_BYTES) throw new Error('That image is larger than 5 MB.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL('image/png');
}
