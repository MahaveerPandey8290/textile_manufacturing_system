import { ArrowRight, Building2, ShieldCheck, UserRound } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getRememberedOrganization } from '../../auth/rememberedOrganization';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { OrganizationMark } from '../../components/auth/OrganizationMark';

/** The front door: organisation owners (sign in or register) and staff (join with a code). */
export default function WelcomePage() {
  const { currentUser, isPlatformAdmin } = useAuth();
  const remembered = getRememberedOrganization();
  if (currentUser) return <Navigate to={isPlatformAdmin ? '/platform' : '/'} replace />;

  return (
    <AuthLayout backTo="/" backLabel="About MillOS">
      <div className="auth-heading">
        <h2>How would you like to continue?</h2>
        <p className="muted">Choose one to get started.</p>
      </div>

      <div className="choice-list">
        <Link to="/organization/signin" className="choice-card">
          <span className="choice-card__icon choice-card__icon--brand"><Building2 size={22} /></span>
          <span className="choice-card__text">
            <strong>Sign in as organisation</strong>
            <span>For mill owners. Sign in, or register your mill and get a code for your team.</span>
          </span>
          <ArrowRight size={18} className="choice-card__arrow" />
        </Link>
        <Link to="/signin" className="choice-card">
          <span className="choice-card__icon choice-card__icon--teal"><UserRound size={22} /></span>
          <span className="choice-card__text">
            <strong>Sign in as staff</strong>
            <span>Got an organisation code from your employer? Start here.</span>
          </span>
          <ArrowRight size={18} className="choice-card__arrow" />
        </Link>
      </div>

      {remembered && (
        <Link to={remembered.entry === 'organization' ? '/organization/signin' : `/signin/${remembered.code}`} className="remembered-org">
          <OrganizationMark name={remembered.name} logoUrl={remembered.logoUrl} size={36} />
          <span>
            <span className="muted" style={{ fontSize: 12 }}>Continue to</span>
            <strong>{remembered.name}</strong>
          </span>
          <ArrowRight size={16} />
        </Link>
      )}

      <p className="auth-footnote">
        <ShieldCheck size={14} /> Running the platform? <Link to="/platform/login">Sign in to the admin console</Link>
      </p>
    </AuthLayout>
  );
}
