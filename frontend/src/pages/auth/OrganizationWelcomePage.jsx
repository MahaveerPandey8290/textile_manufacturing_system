import { ArrowRight, AtSign, Building2, KeyRound } from 'lucide-react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { forgetOrganization } from '../../auth/rememberedOrganization';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { DetailRows, WelcomeHero } from '../../components/auth/WelcomeCard';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/EmptyState';
import { FullPageSpinner } from '../../components/ui/Spinner';
import { useOrganizationBranding } from '../../hooks/useOrganizationBranding';

/** Staff step 2: the code matched an organisation. Show who it is before asking for credentials. */
export default function OrganizationWelcomePage() {
  const { organizationCode } = useParams();
  const code = organizationCode.toUpperCase();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { data: organization, isLoading, error } = useOrganizationBranding(code);

  if (currentUser) return <Navigate to="/" replace />;
  if (isLoading && !organization) return <FullPageSpinner />;
  if (error) {
    return (
      <AuthLayout backTo="/signin" backLabel="Enter a different code">
        <ErrorState error={{ message: error.status === 404 ? "This organisation code isn't valid any more. Ask your employer for the current one." : error.message }} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout organization={organization} backTo="/signin" backLabel="Enter a different code">
      <WelcomeHero organization={organization} eyebrow="Organisation verified" title={`Welcome to ${organization.name}`}>
        Your organisation code is correct. Check these details, then sign in with your work account.
      </WelcomeHero>

      <DetailRows
        rows={[
          { icon: <Building2 size={20} />, label: 'Organisation', value: organization.name, sub: organization.city },
          { icon: <KeyRound size={20} />, label: 'Organisation code', value: <span className="mono">{organization.code}</span>, status: 'Active' },
          { icon: <AtSign size={20} />, label: 'Work email', value: `@${organization.emailDomain}`, sub: 'Staff sign in with an address on this domain.' },
        ]}
      />

      <Button icon={ArrowRight} onClick={() => navigate(`/signin/${code}`)}>Continue to sign in</Button>
      <p className="auth-footnote auth-footnote--center">
        Not your organisation? <Link to="/signin" onClick={() => forgetOrganization()}>Use another code</Link>
      </p>
    </AuthLayout>
  );
}
