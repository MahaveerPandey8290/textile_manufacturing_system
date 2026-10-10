import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { forgetOrganization, getRememberedOrganization } from '../../auth/rememberedOrganization';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { PasswordInput } from '../../components/auth/PasswordInput';
import { Button } from '../../components/ui/Button';
import { FormField, fieldErrorsFrom } from '../../components/ui/FormField';
import { PLATFORM_NAME } from '../../config/platform';
import { workEmailProblem } from '../../utils/emailRules';

/**
 * "Welcome back" sign-in for organisation owners: work email and password, no code.
 * New organisations register from the link at the bottom. If this device signed in to an
 * organisation before, its logo and name are already shown.
 */
export default function OrganizationSignInPage() {
  const { currentUser, signInOrganizationAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [remembered, setRemembered] = useState(() => {
    const stored = getRememberedOrganization();
    return stored?.entry === 'organization' ? stored : null;
  });
  const [email, setEmail] = useState(location.state?.email ?? '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  if (currentUser && !isSubmitting) return <Navigate to="/" replace />;

  const liveEmailProblem = workEmailProblem(email);

  const submit = async (event) => {
    event.preventDefault();
    const found = {};
    if (!email.includes('@')) found.email = 'Enter your work email.';
    else if (liveEmailProblem) found.email = liveEmailProblem;
    if (!password) found.password = 'Enter your password.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setIsSubmitting(true);
    setFormError('');
    try {
      await signInOrganizationAdmin({ email, password });
      navigate('/signed-in', { replace: true, state: { from: location.state?.from } });
    } catch (failure) {
      setErrors(fieldErrorsFrom(failure));
      setFormError(failure.details ? '' : failure.message);
      setIsSubmitting(false);
    }
  };

  const switchOrganization = () => {
    forgetOrganization();
    setRemembered(null);
    setEmail('');
  };

  return (
    <AuthLayout organization={remembered ?? undefined} backTo="/welcome">
      <div className="auth-heading">
        <h2>Welcome back!</h2>
        <p className="muted">
          {remembered ? `Sign in to ${remembered.name} on ${PLATFORM_NAME}.` : `Sign in to your organisation's ${PLATFORM_NAME} account.`}
        </p>
      </div>
      {formError && <div className="callout callout--danger">{formError}</div>}
      <form className="auth-form" onSubmit={submit} noValidate>
        <FormField label="Work email" error={errors.email || liveEmailProblem}>
          <input
            className="input"
            type="email"
            autoFocus
            autoComplete="username"
            placeholder={remembered ? `you@${remembered.emailDomain}` : 'you@yourcompany.com'}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>
        <div className="form-field">
          <div className="row row--between">
            <span className="form-field__label">Password</span>
            <Link to="/organization/reset" state={{ email }} className="form-field__link">Forgot password?</Link>
          </div>
          <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
          {errors.password && <span className="form-field__error">{errors.password}</span>}
        </div>
        <Button type="submit" icon={LogIn} isLoading={isSubmitting}>Sign in</Button>
      </form>

      {remembered && (
        <p className="auth-footnote auth-footnote--center">
          Not {remembered.name}? <button type="button" className="link-button" onClick={switchOrganization}>Sign in to another organisation</button>
        </p>
      )}
      <p className="auth-footnote auth-footnote--center">
        New organisation? <Link to="/signup">Register as organisation</Link>
      </p>
      <p className="auth-footnote auth-footnote--center">
        Staff member? <Link to="/signin">Sign in with your organisation code</Link>
      </p>
    </AuthLayout>
  );
}
