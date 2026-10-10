import { ArrowRight, Building2, UserRoundCheck } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { OrganizationMark } from '../../components/auth/OrganizationMark';
import { DetailRows, WelcomeHero } from '../../components/auth/WelcomeCard';
import { Button } from '../../components/ui/Button';
import { ROLE_LABELS } from '../../config/navigation';

/** Shown right after any organisation sign-in: whose workspace this is, and who is signed in. */
export default function SignedInWelcomePage() {
  const { currentUser, organization, isPlatformAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  if (!currentUser) return <Navigate to="/welcome" replace />;
  if (isPlatformAdmin || !organization) return <Navigate to="/platform" replace />;

  const firstName = currentUser.fullName.split(/\s+/)[0];
  const destination = location.state?.from?.pathname ?? '/';

  return (
    <AuthLayout organization={organization}>
      <WelcomeHero organization={organization} eyebrow="Signed in" title={`Welcome to ${organization.name}`}>
        Good to see you, {firstName}. Your account has been verified for {organization.name}.
      </WelcomeHero>

      <DetailRows
        rows={[
          {
            icon: <OrganizationMark name={organization.name} logoUrl={organization.logoUrl} size={40} />,
            label: 'Organisation',
            value: organization.name,
            sub: [organization.city, organization.code].filter(Boolean).join(' · '),
          },
          {
            icon: <UserRoundCheck size={20} />,
            label: currentUser.role === 'BUYER' ? 'Buyer' : 'Signed in as',
            value: `${currentUser.fullName} (${ROLE_LABELS[currentUser.role] ?? currentUser.role})`,
            sub: currentUser.buyerCompany ?? currentUser.email,
            status: 'Active',
          },
        ]}
      />

      <Button icon={ArrowRight} autoFocus onClick={() => navigate(destination, { replace: true })}>
        {currentUser.role === 'OWNER' ? 'Go to my dashboard' : 'Continue'}
      </Button>
      <p className="auth-footnote auth-footnote--center muted">
        <Building2 size={14} /> Everything you see next belongs to {organization.name} only.
      </p>
    </AuthLayout>
  );
}
