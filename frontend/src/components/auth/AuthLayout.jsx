import { ArrowLeft, Factory, Fingerprint, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PLATFORM_NAME, PLATFORM_TAGLINE } from '../../config/platform';
import { OrganizationMark, PlatformMark } from './OrganizationMark';

const PLATFORM_POINTS = [
  { icon: Factory, title: 'Built for mills', text: 'Yarn, looms, QC, dispatch and wages in one place.' },
  { icon: ShieldCheck, title: 'Your data stays yours', text: 'Every organisation gets its own isolated database.' },
  { icon: Users, title: 'Staff join with a code', text: 'Share one code; people sign in with their work email.' },
  { icon: Fingerprint, title: 'Verified by email', text: 'One-time codes for first sign-in and resets.' },
];

/**
 * Two-panel frame for every sign-up / sign-in screen.
 * Once an organisation is known (after its code is entered), its logo and name take over
 * the brand panel and stay there until the person is inside the app.
 */
export function AuthLayout({ organization, backTo, backLabel = 'Back', children }) {
  return (
    <div className="auth">
      <aside className={`auth__brand ${organization ? 'auth__brand--organization' : ''}`}>
        <div className="auth__brand-top">
          {organization ? (
            <div className="auth__org-chip">
              <OrganizationMark name={organization.name} logoUrl={organization.logoUrl} size={28} />
              <span>{organization.name}</span>
            </div>
          ) : (
            <div className="auth__platform-chip">
              <PlatformMark size={30} />
              <strong>{PLATFORM_NAME}</strong>
            </div>
          )}
        </div>

        {organization ? (
          <div className="auth__welcome">
            <OrganizationMark name={organization.name} logoUrl={organization.logoUrl} size={112} className="auth__welcome-logo" />
            <p className="auth__eyebrow">Welcome to</p>
            <h1>{organization.name}</h1>
            {organization.city && <p className="auth__lead">{organization.city}</p>}
            <span className="auth__code-pill">Organisation code · <span className="mono">{organization.code}</span></span>
          </div>
        ) : (
          <div className="auth__pitch">
            <p className="auth__eyebrow">{PLATFORM_TAGLINE}</p>
            <h1>Run every mill from one screen, without the paperwork.</h1>
            <div className="auth__points">
              {PLATFORM_POINTS.map((point) => (
                <div key={point.title} className="auth__point">
                  <point.icon size={18} />
                  <div>
                    <strong>{point.title}</strong>
                    <span>{point.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="auth__brand-foot">{organization ? `Secured by ${PLATFORM_NAME}` : `© ${new Date().getFullYear()} ${PLATFORM_NAME}`}</div>
      </aside>

      <main className="auth__panel">
        <div className="auth__panel-inner">
          {/* On phones the brand panel is hidden, so show the organisation (or platform) here instead. */}
          <div className="auth__compact-brand">
            {organization ? (
              <>
                <OrganizationMark name={organization.name} logoUrl={organization.logoUrl} size={44} />
                <div>
                  <div className="muted" style={{ fontSize: 12 }}>Welcome to</div>
                  <strong>{organization.name}</strong>
                </div>
              </>
            ) : (
              <>
                <PlatformMark size={36} />
                <strong>{PLATFORM_NAME}</strong>
              </>
            )}
          </div>
          {backTo && (
            <Link to={backTo} className="auth__back">
              <ArrowLeft size={16} /> {backLabel}
            </Link>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

/** Small "Step 2 of 3" progress shown above multi-step forms. */
export function StepIndicator({ steps, current }) {
  return (
    <ol className="auth-steps" aria-label="Progress">
      {steps.map((label, index) => (
        <li key={label} className={index < current ? 'is-done' : index === current ? 'is-current' : ''}>
          <span className="auth-steps__dot">{index + 1}</span>
          <span className="auth-steps__label">{label}</span>
        </li>
      ))}
    </ol>
  );
}
