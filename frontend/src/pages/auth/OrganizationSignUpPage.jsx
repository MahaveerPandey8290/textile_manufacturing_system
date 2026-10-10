import { ArrowRight, Building2 } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { AuthLayout, StepIndicator } from '../../components/auth/AuthLayout';
import { LogoUpload } from '../../components/auth/LogoUpload';
import { PasswordInput } from '../../components/auth/PasswordInput';
import { Button } from '../../components/ui/Button';
import { FormField, fieldErrorsFrom } from '../../components/ui/FormField';
import { emailDomainOf, isStrongPassword, workEmailProblem } from '../../utils/emailRules';

const STEPS = ['Your organisation', 'Your account'];
const EMPTY_FORM = {
  name: '', city: '', phone: '', gstNumber: '', logo: '',
  fullName: '', email: '', password: '', confirmPassword: '',
};

/** Short, two-step sign-up. Only what is needed to start; everything else can come later. */
export default function OrganizationSignUpPage() {
  const { currentUser, signUpOrganization } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (currentUser && !isSubmitting) return <Navigate to="/" replace />;

  const update = (field) => (eventOrValue) => {
    const value = typeof eventOrValue === 'string' ? eventOrValue : eventOrValue.target.value;
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validateOrganization = () => {
    const found = {};
    if (form.name.trim().length < 2) found.name = 'Enter your organisation name.';
    if (form.city.trim().length < 2) found.city = 'Enter the city your mill is in.';
    if (form.gstNumber && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(form.gstNumber.trim().toUpperCase())) found.gstNumber = 'Enter a valid 15-character GSTIN, or leave it empty.';
    return found;
  };
  const validateAccount = () => {
    const found = {};
    if (form.fullName.trim().length < 2) found.fullName = 'Enter your full name.';
    if (!form.email.includes('@')) found.email = 'Enter your work email.';
    else if (workEmailProblem(form.email)) found.email = workEmailProblem(form.email);
    if (!isStrongPassword(form.password)) found.password = 'Choose a stronger password.';
    if (form.password !== form.confirmPassword) found.confirmPassword = 'Passwords do not match.';
    return found;
  };

  const goToAccountStep = (event) => {
    event.preventDefault();
    const found = validateOrganization();
    setErrors(found);
    if (!Object.keys(found).length) setStep(1);
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = validateAccount();
    setErrors(found);
    if (Object.keys(found).length) return;
    setIsSubmitting(true);
    setFormError('');
    try {
      const organizationCode = await signUpOrganization({
        organization: { name: form.name, city: form.city, phone: form.phone, gstNumber: form.gstNumber, logo: form.logo || undefined },
        owner: { fullName: form.fullName, email: form.email, password: form.password, confirmPassword: form.confirmPassword },
      });
      navigate('/signup/done', { replace: true, state: { organizationCode } });
    } catch (error) {
      setIsSubmitting(false);
      // Server field names look like "organization.city" / "owner.email".
      const serverErrors = Object.fromEntries(Object.entries(fieldErrorsFrom(error)).map(([field, message]) => [field.split('.').pop(), message]));
      setErrors(serverErrors);
      setFormError(Object.keys(serverErrors).length ? '' : error.message);
      if (Object.keys(serverErrors).some((field) => ['name', 'city', 'phone', 'gstNumber', 'logo'].includes(field))) setStep(0);
    }
  };

  const emailDomain = emailDomainOf(form.email);

  return (
    <AuthLayout backTo={step === 0 ? '/organization/signin' : undefined} backLabel="Back to sign in">
      {step === 1 && (
        <button type="button" className="auth__back" onClick={() => setStep(0)}>
          ← Back to organisation details
        </button>
      )}
      <div className="auth-heading">
        <h2>Register your organisation</h2>
        <p className="muted">Two short steps. You can add the rest later from settings.</p>
      </div>
      <StepIndicator steps={STEPS} current={step} />
      {formError && <div className="callout callout--danger">{formError}</div>}

      {step === 0 ? (
        <form className="auth-form" onSubmit={goToAccountStep} noValidate>
          <LogoUpload value={form.logo} onChange={update('logo')} organizationName={form.name} error={errors.logo} />
          <FormField label="Organisation name" error={errors.name}>
            <input className="input" autoFocus autoComplete="organization" placeholder="e.g. Everest Textile Mills" value={form.name} onChange={update('name')} />
          </FormField>
          <FormField label="City" error={errors.city}>
            <input className="input" autoComplete="address-level2" placeholder="e.g. Surat, Gujarat" value={form.city} onChange={update('city')} />
          </FormField>
          <div className="form-row-2">
            <FormField label="Phone" hint="Optional" error={errors.phone}>
              <input className="input" type="tel" autoComplete="tel" placeholder="+91 98765 43210" value={form.phone} onChange={update('phone')} />
            </FormField>
            <FormField label="GSTIN" hint="Optional" error={errors.gstNumber}>
              <input className="input mono" maxLength={15} placeholder="27AABCE1234F1Z5" value={form.gstNumber} onChange={(event) => update('gstNumber')(event.target.value.toUpperCase())} />
            </FormField>
          </div>
          <Button type="submit" icon={ArrowRight}>Continue</Button>
        </form>
      ) : (
        <form className="auth-form" onSubmit={submit} noValidate>
          <FormField label="Your full name" error={errors.fullName}>
            <input className="input" autoFocus autoComplete="name" value={form.fullName} onChange={update('fullName')} />
          </FormField>
          <FormField
            label="Work email"
            error={errors.email || workEmailProblem(form.email)}
            hint={emailDomain.includes('.') ? `Your staff will sign in with @${emailDomain} addresses.` : 'Use your company email, not Gmail or Yahoo.'}
          >
            <input className="input" type="email" autoComplete="email" placeholder="you@yourcompany.com" value={form.email} onChange={update('email')} />
          </FormField>
          <FormField label="Password" error={errors.password}>
            <PasswordInput value={form.password} onChange={update('password')} autoComplete="new-password" showRules />
          </FormField>
          <FormField label="Confirm password" error={errors.confirmPassword}>
            <PasswordInput value={form.confirmPassword} onChange={update('confirmPassword')} autoComplete="new-password" />
          </FormField>
          <Button type="submit" icon={Building2} isLoading={isSubmitting}>Create organisation</Button>
        </form>
      )}

      <p className="auth-footnote">
        Already registered? <Link to="/organization/signin">Sign in to your organisation</Link>
      </p>
    </AuthLayout>
  );
}
