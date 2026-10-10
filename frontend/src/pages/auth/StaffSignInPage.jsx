import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { forgetOrganization } from '../../auth/rememberedOrganization';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { PasswordInput } from '../../components/auth/PasswordInput';
import { RolePicker } from '../../components/auth/RolePicker';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/EmptyState';
import { FormField, fieldErrorsFrom } from '../../components/ui/FormField';
import { FullPageSpinner } from '../../components/ui/Spinner';
import { useOrganizationBranding } from '../../hooks/useOrganizationBranding';
import { workEmailProblem } from '../../utils/emailRules';

/** Staff step 3: the organisation is known (logo + name shown); now role, work email, password. */
export default function StaffSignInPage() {
  const { organizationCode } = useParams();
  const code = organizationCode.toUpperCase();
  const { currentUser, signInStaff } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: organization, isLoading, error } = useOrganizationBranding(code);
  const [role, setRole] = useState(location.state?.role ?? '');
  const [email, setEmail] = useState(location.state?.email ?? '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (currentUser) return <Navigate to="/" replace />;
  if (isLoading && !organization) return <FullPageSpinner />;
  if (error) {
    return (
      <AuthLayout backTo="/signin" backLabel="Enter a different code">
        <ErrorState error={{ message: error.status === 404 ? "This organisation code isn't valid any more. Ask your employer for the current one." : error.message }} />
      </AuthLayout>
    );
  }

  const requiredDomain = role && role !== 'BUYER' ? organization.emailDomain : undefined;
  const liveEmailProblem = workEmailProblem(email, { requiredDomain });

  const submit = async (event) => {
    event.preventDefault();
    const found = {};
    if (!role) found.role = 'Choose your role.';
    if (!email.includes('@')) found.email = 'Enter your work email.';
    else if (liveEmailProblem) found.email = liveEmailProblem;
    if (!password) found.password = 'Enter your password.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setIsSubmitting(true);
    setFormError('');
    try {
      await signInStaff({ organizationCode: code, role, email, password });
      navigate('/signed-in', { replace: true, state: { from: location.state?.from } });
    } catch (failure) {
      setErrors(fieldErrorsFrom(failure));
      setFormError(failure.details ? '' : failure.message);
      setIsSubmitting(false);
    }
  };

  const resetLink = (mode) => ({ pathname: `/signin/${code}/reset`, search: `?mode=${mode}`, state: { email } });

  return (
    <AuthLayout organization={organization} backTo="/signin" backLabel="Not your organisation?">
      <div className="auth-heading">
        <h2>Staff sign in</h2>
        <p className="muted">Sign in to your {organization.name} staff account.</p>
      </div>
      {formError && <div className="callout callout--danger">{formError}</div>}
      <form className="auth-form" onSubmit={submit} noValidate>
        <FormField label="Your role" error={errors.role}>
          <RolePicker value={role} onChange={(nextRole) => { setRole(nextRole); setErrors((current) => ({ ...current, role: undefined })); }} />
        </FormField>
        <FormField
          label={role === 'BUYER' ? 'Company email' : 'Work email'}
          error={errors.email || liveEmailProblem}
          hint={role === 'BUYER' ? 'The company email the mill has on file for you.' : `Your @${organization.emailDomain} address. Personal Gmail or Yahoo won't work.`}
        >
          <input className="input" type="email" autoComplete="username" placeholder={role === 'BUYER' ? 'you@yourcompany.com' : `name@${organization.emailDomain}`} value={email} onChange={(event) => setEmail(event.target.value)} />
        </FormField>
        <div className="form-field">
          <div className="row row--between">
            <span className="form-field__label">Password</span>
            <Link to={resetLink('reset')} className="form-field__link">Forgot password?</Link>
          </div>
          <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
          {errors.password && <span className="form-field__error">{errors.password}</span>}
        </div>
        <Button type="submit" icon={LogIn} isLoading={isSubmitting}>Sign in</Button>
      </form>

      <div className="first-time">
        <strong>First time here?</strong>
        <span className="muted">If your employer added you, verify your email and choose a password.</span>
        <Link to={resetLink('setup')} className="button button--secondary button--sm">Set up my account</Link>
      </div>

      <p className="auth-footnote">
        Signing in to a different organisation?{' '}
        <Link to="/signin" onClick={() => forgetOrganization()}>Use another code</Link>
      </p>
    </AuthLayout>
  );
}
