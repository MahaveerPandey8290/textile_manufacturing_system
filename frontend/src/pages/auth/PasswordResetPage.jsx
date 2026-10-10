import { ArrowRight, CheckCircle2, MailCheck, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../api/httpClient';
import { useAuth } from '../../auth/AuthContext';
import { AuthLayout, StepIndicator } from '../../components/auth/AuthLayout';
import { OtpInput } from '../../components/auth/OtpInput';
import { PasswordInput } from '../../components/auth/PasswordInput';
import { Button } from '../../components/ui/Button';
import { FormField, fieldErrorsFrom } from '../../components/ui/FormField';
import { FullPageSpinner } from '../../components/ui/Spinner';
import { getRememberedOrganization } from '../../auth/rememberedOrganization';
import { useOrganizationBranding } from '../../hooks/useOrganizationBranding';
import { isStrongPassword, workEmailProblem } from '../../utils/emailRules';

const STEPS = ['Work email', 'Verify code', 'New password'];
const RESEND_SECONDS = 60;

/**
 * Forgot password and first-time account setup share one flow:
 * work email -> 6-digit code from the inbox -> new password + confirm -> done.
 * Staff come here with their organisation code in the URL. Organisation owners come from the
 * "Welcome back" page without one; the server finds their organisation from the email.
 */
export default function PasswordResetPage() {
  const { organizationCode } = useParams();
  const code = organizationCode?.toUpperCase();
  const isOwnerReset = !code;
  const remembered = getRememberedOrganization();
  const [searchParams] = useSearchParams();
  const isSetup = searchParams.get('mode') === 'setup';
  const location = useLocation();
  const { currentUser } = useAuth();
  const { data: branding, isLoading, error: brandingError } = useOrganizationBranding(code);
  const organization = isOwnerReset ? (remembered?.entry === 'organization' ? remembered : null) : branding;
  const organizationName = organization?.name ?? 'your organisation';
  const signInPath = isOwnerReset ? '/organization/signin' : `/signin/${code}`;

  const [step, setStep] = useState(0);
  const [email, setEmail] = useState(location.state?.email ?? '');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  if (currentUser) return <Navigate to="/" replace />;
  if (!isOwnerReset && isLoading && !organization) return <FullPageSpinner />;
  if (!isOwnerReset && brandingError) return <Navigate to="/signin" replace />;

  const run = async (work) => {
    setIsWorking(true);
    setFormError('');
    try {
      await work();
    } catch (failure) {
      setErrors(fieldErrorsFrom(failure));
      setFormError(failure.details ? '' : failure.message);
    } finally {
      setIsWorking(false);
    }
  };

  const requestCode = (event) => {
    event?.preventDefault();
    const problem = !email.includes('@') ? 'Enter your work email.' : workEmailProblem(email);
    if (problem) return setErrors({ email: problem });
    setErrors({});
    return run(async () => {
      await api.post('/auth/password/request-code', { organizationCode: code, email });
      setOtp('');
      setResendIn(RESEND_SECONDS);
      setStep(1);
    });
  };

  const verifyCode = (codeToCheck = otp) =>
    run(async () => {
      if (codeToCheck.length !== 6) throw new Error('Enter all 6 digits.');
      const response = await api.post('/auth/password/verify-code', { organizationCode: code, email, code: codeToCheck });
      setResetToken(response.resetToken);
      setStep(2);
    });

  const savePassword = (event) => {
    event.preventDefault();
    const found = {};
    if (!isStrongPassword(newPassword)) found.newPassword = 'Choose a stronger password.';
    if (newPassword !== confirmPassword) found.confirmPassword = 'Passwords do not match.';
    setErrors(found);
    if (Object.keys(found).length) return;
    run(async () => {
      setResult(await api.post('/auth/password/reset', { resetToken, newPassword, confirmPassword }));
      setStep(3);
    });
  };

  const title = isSetup ? 'Set up your account' : 'Reset your password';

  return (
    <AuthLayout organization={organization ?? undefined} backTo={step < 3 ? signInPath : undefined} backLabel="Back to sign in">
      {step < 3 && (
        <>
          <div className="auth-heading">
            <h2>{title}</h2>
            <p className="muted">
              {isSetup
                ? `Your employer added you to ${organizationName}. Verify your work email, then choose a password.`
                : "We'll email you a 6-digit code to confirm it's you."}
            </p>
          </div>
          <StepIndicator steps={STEPS} current={step} />
          {formError && <div className="callout callout--danger">{formError}</div>}
        </>
      )}

      {step === 0 && (
        <form className="auth-form" onSubmit={requestCode} noValidate>
          <FormField label="Work email" error={errors.email} hint={isOwnerReset ? 'The work email you registered your organisation with.' : `The email ${organizationName} has on file for you.`}>
            <input className="input" type="email" autoFocus autoComplete="email" placeholder={organization ? `name@${organization.emailDomain}` : 'you@yourcompany.com'} value={email} onChange={(event) => setEmail(event.target.value)} />
          </FormField>
          <Button type="submit" icon={ArrowRight} isLoading={isWorking}>Send code</Button>
        </form>
      )}

      {step === 1 && (
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            verifyCode();
          }}
        >
          <div className="callout callout--info">
            <MailCheck size={18} />
            <span>If <strong>{email}</strong> belongs to {organizationName}, a code is on its way. It expires in 10 minutes.</span>
          </div>
          <FormField label="6-digit code" error={errors.code}>
            <OtpInput
              value={otp}
              disabled={isWorking}
              onChange={(value) => {
                setOtp(value);
                if (value.length === 6) verifyCode(value);
              }}
            />
          </FormField>
          {import.meta.env.DEV && <p className="muted" style={{ fontSize: 12 }}>Local setup without email? The code is printed in the API terminal.</p>}
          <Button type="submit" icon={ArrowRight} isLoading={isWorking}>Verify</Button>
          <div className="row row--between" style={{ fontSize: 13 }}>
            <button type="button" className="link-button" onClick={() => setStep(0)}>Change email</button>
            <button type="button" className="link-button" disabled={resendIn > 0 || isWorking} onClick={() => requestCode()}>
              <RotateCcw size={13} /> {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form className="auth-form" onSubmit={savePassword} noValidate>
          <FormField label="New password" error={errors.newPassword}>
            <PasswordInput value={newPassword} onChange={setNewPassword} autoComplete="new-password" showRules autoFocus />
          </FormField>
          <FormField label="Confirm new password" error={errors.confirmPassword}>
            <PasswordInput value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
          </FormField>
          <Button type="submit" isLoading={isWorking}>{isSetup ? 'Create my account' : 'Save new password'}</Button>
        </form>
      )}

      {step === 3 && (
        <div className="auth-done">
          <div className="success-badge"><CheckCircle2 size={28} /></div>
          <h2>{result?.accountCreated ? 'Account successfully created' : 'Password updated'}</h2>
          <p className="muted">
            {result?.accountCreated
              ? `Welcome to ${result.organization?.name ?? organizationName}. Sign in with your role, work email and new password.`
              : isOwnerReset
              ? 'You can now sign in with your work email and new password.'
              : 'You can now sign in with your new password.'}
          </p>
          <Link to={signInPath} state={{ email }} className="button button--primary button--md">
            <span>Continue to sign in</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}
