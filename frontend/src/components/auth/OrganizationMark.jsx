/** An organisation's logo, or its initials on a coloured tile when it has none. */
export function OrganizationMark({ name = '', logoUrl, size = 40, className = '' }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const style = { width: size, height: size, borderRadius: Math.round(size * 0.24), fontSize: Math.round(size * 0.38) };
  return logoUrl ? (
    <img className={`org-mark ${className}`} src={logoUrl} alt={`${name} logo`} style={style} />
  ) : (
    <span className={`org-mark org-mark--initials ${className}`} style={style} aria-label={name}>
      {initials || '?'}
    </span>
  );
}

/** The MillOS mark, used where no organisation is known yet. */
export function PlatformMark({ size = 36 }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#3b5bdb" />
      <path d="M7 23V9l5 6 4-6 4 6 5-6v14" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M7 26h18" stroke="#2dd4bf" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
