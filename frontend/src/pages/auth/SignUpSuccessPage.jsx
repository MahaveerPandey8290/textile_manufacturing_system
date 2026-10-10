import { ArrowRight, Check, Copy, Mail, MessageCircle, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { FullPageSpinner } from '../../components/ui/Spinner';
import { PLATFORM_NAME } from '../../config/platform';

/** Shown once after sign-up: the organisation code staff need, with easy ways to share it. */
export default function SignUpSuccessPage() {
  const { organization, isCheckingSession } = useAuth();
  const location = useLocation();
  const [isCopied, setIsCopied] = useState(false);
  if (isCheckingSession) return <FullPageSpinner />;
  if (!organization) return <Navigate to="/welcome" replace />;

  const code = location.state?.organizationCode ?? organization.code;
  const signInUrl = `${window.location.origin}/signin/${code}`;
  const shareText = `Join ${organization.name} on ${PLATFORM_NAME}. Open ${signInUrl} (organisation code ${code}) and sign in with your work email.`;

  const copyCode = async () => {
    await navigator.clipboard?.writeText(code).catch(() => {});
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <AuthLayout organization={organization}>
      <div className="success-badge"><Check size={26} /></div>
      <div className="auth-heading">
        <h2>Your organisation is ready</h2>
        <p className="muted">Share this code with your staff. They need it once, to find {organization.name}.</p>
      </div>

      <div className="org-code-card">
        <span className="org-code-card__label">Organisation code</span>
        <div className="org-code-card__code mono">{code}</div>
        <div className="org-code-card__actions">
          <button type="button" className="button button--secondary button--sm" onClick={copyCode}>
            {isCopied ? <Check size={14} /> : <Copy size={14} />}
            <span>{isCopied ? 'Copied' : 'Copy code'}</span>
          </button>
          <a className="button button--secondary button--sm" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
            <MessageCircle size={14} /><span>WhatsApp</span>
          </a>
          <a className="button button--secondary button--sm" href={`mailto:?subject=${encodeURIComponent(`Join ${organization.name}`)}&body=${encodeURIComponent(shareText)}`}>
            <Mail size={14} /><span>Email</span>
          </a>
        </div>
      </div>

      <ol className="join-steps">
        <li><strong>Add your staff</strong> under Users &amp; roles with their work email and role.</li>
        <li><strong>They open {PLATFORM_NAME}</strong>, choose “Sign in as staff” and enter <span className="mono">{code}</span>.</li>
        <li><strong>First time?</strong> They verify their email with a one-time code and set a password.</li>
      </ol>

      <div className="auth-form">
        <Link to="/admin/users" className="button button--secondary button--md"><UserPlus size={16} /><span>Add staff now</span></Link>
        <Link to="/" className="button button--primary button--md"><span>Go to my dashboard</span><ArrowRight size={16} /></Link>
      </div>
    </AuthLayout>
  );
}
