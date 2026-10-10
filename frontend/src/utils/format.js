const rupeeFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const numberFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const compactFormatter = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });

export const formatCurrency = (value) => (value === null || value === undefined ? '—' : rupeeFormatter.format(value));
export const formatNumber = (value, unit) =>
  value === null || value === undefined ? '—' : `${numberFormatter.format(value)}${unit ? ` ${unit}` : ''}`;
export const formatCompact = (value) => (value === null || value === undefined ? '—' : compactFormatter.format(value));
/** Lakh / crore shorthand that Indian mill owners actually use. */
export function formatRupeesShort(value) {
  if (value === null || value === undefined) return '—';
  const absolute = Math.abs(value);
  if (absolute >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr`;
  if (absolute >= 1e5) return `₹${(value / 1e5).toFixed(2)} L`;
  return formatCurrency(value);
}

export function formatDate(value) {
  if (!value) return '—';
  const date = typeof value === 'string' && value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
export function formatRelative(value) {
  if (!value) return '—';
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
export const daysUntil = (isoDate) => Math.round((new Date(`${isoDate}T00:00:00`) - new Date(new Date().toDateString())) / 86_400_000);

export const todayIso = () => new Date().toLocaleDateString('en-CA');
export const currentMonthIso = () => todayIso().slice(0, 7);
export const humanize = (value) => (value ? value.toLowerCase().replaceAll('_', ' ').replace(/^\w/, (letter) => letter.toUpperCase()) : '—');
export const percent = (part, whole) => (whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0);
