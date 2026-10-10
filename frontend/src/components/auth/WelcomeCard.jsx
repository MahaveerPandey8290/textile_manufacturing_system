import { BadgeCheck } from 'lucide-react';
import { OrganizationMark } from './OrganizationMark';

/** Big centred organisation logo with a "verified" tick, the heading and a short line under it. */
export function WelcomeHero({ organization, eyebrow, title, children }) {
  return (
    <div className="welcome-hero">
      <div className="welcome-hero__logo">
        <OrganizationMark name={organization.name} logoUrl={organization.logoUrl} size={88} />
        <span className="welcome-hero__tick" aria-hidden><BadgeCheck size={22} /></span>
      </div>
      {eyebrow && <p className="welcome-hero__eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}

/** Labelled rows in a soft panel: icon tile, small caps label, value, optional trailing status. */
export function DetailRows({ rows }) {
  return (
    <div className="detail-rows">
      {rows.map((row) => (
        <div key={row.label} className="detail-rows__row">
          <span className="detail-rows__icon">{row.icon}</span>
          <div className="detail-rows__text">
            <span className="detail-rows__label">{row.label}</span>
            <strong>{row.value}</strong>
            {row.sub && <span className="detail-rows__sub">{row.sub}</span>}
          </div>
          {row.status && <span className="detail-rows__status">{row.status}</span>}
        </div>
      ))}
    </div>
  );
}
