export function ProgressBar({ value, max = 100, tone = 'brand', showLabel = false, segments }) {
  if (segments) {
    // Stacked bar, e.g. dispatched / passed / in QC out of ordered meters.
    return (
      <div className="progress" role="img" aria-label={segments.map((segment) => `${segment.label} ${segment.value}`).join(', ')}>
        {segments.map((segment) => (
          <div
            key={segment.label}
            className={`progress__fill progress__fill--${segment.tone}`}
            style={{ width: `${Math.min(100, (segment.value / max) * 100)}%` }}
            title={segment.label}
          />
        ))}
      </div>
    );
  }
  const percentage = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="progress-wrap">
      <div className="progress" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
        <div className={`progress__fill progress__fill--${tone}`} style={{ width: `${percentage}%` }} />
      </div>
      {showLabel && <span className="progress__label">{percentage}%</span>}
    </div>
  );
}
