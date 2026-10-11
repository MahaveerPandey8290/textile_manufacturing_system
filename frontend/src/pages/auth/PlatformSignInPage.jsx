import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { PasswordInput } from '../../components/auth/PasswordInput';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import { PLATFORM_NAME } from '../../config/platform';

/** Super admin sign-in. Separate from organisation sign-in: no code, no role. */
export default function PlatformSignInPage() {
  const { currentUser, isPlatformAdmin, signInPlatformAdmin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  if (currentUser && isPlatformAdmin) return <Navigate to="/platform" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await signInPlatformAdmin({ email, password });
      navigate('/platform', { replace: true });
    } catch (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout backTo="/welcome">
      <div className="auth-heading">
        <span className="auth-heading__icon"><ShieldCheck size={20} /></span>
        <h2>{PLATFORM_NAME} admin console</h2>
        <p className="muted">For the team that runs the platform. Organisations sign in from the <Link to="/welcome">main page</Link>.</p>
      </div>
      {currentUser && !isPlatformAdmin && (
        <div className="callout callout--info" style={{ marginBottom: 14 }}>
          Currently signed in as <strong>{currentUser.fullName}</strong>. Sign in below with platform admin credentials to access the console.
        </div>
      )}
      {errorMessage && <div className="callout callout--danger">{errorMessage}</div>}
      <form className="auth-form" onSubmit={submit}>
        <FormField label="Email">
          <input className="input" type="email" autoFocus autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </FormField>
        <FormField label="Password">
          <PasswordInput value={password} onChange={setPassword} required />
        </FormField>
        <Button type="submit" icon={ShieldCheck} isLoading={isSubmitting}>Sign in to console</Button>
      </form>
    </AuthLayout>
  );
}
