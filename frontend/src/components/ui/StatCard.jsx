export function StatCard({ label, value, hint, icon: Icon, tone = 'brand', onClick }) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper className={`stat-card stat-card--${tone} ${onClick ? 'stat-card--clickable' : ''}`} onClick={onClick}>
      <div className="stat-card__top">
        <span className="stat-card__label">{label}</span>
        {Icon && (
          <span className="stat-card__icon">
            <Icon size={18} />
          </span>
        )}
      </div>
      <div className="stat-card__value">{value}</div>
      {hint && <div className="stat-card__hint">{hint}</div>}
    </Wrapper>
  );
}
