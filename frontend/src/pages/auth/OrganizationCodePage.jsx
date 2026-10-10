import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../../api/httpClient';
import { useAuth } from '../../auth/AuthContext';
import { rememberOrganization } from '../../auth/rememberedOrganization';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';

/** Formats as people type: "eve k7m2q" -> "EVE-K7M2Q". */
function formatCode(text) {
  const characters = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return characters.length > 3 ? `${characters.slice(0, 3)}-${characters.slice(3)}` : characters;
}

/** Staff step 1: which organisation do you work for? Next comes its welcome screen. */
export default function OrganizationCodePage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  if (currentUser) return <Navigate to="/" replace />;

  const isComplete = /^[A-Z0-9]{3}-[A-Z0-9]{5}$/.test(code);

  const submit = async (event) => {
    event.preventDefault();
    if (!isComplete) return setErrorMessage('Organisation codes have 8 characters, like EVE-K7M2Q.');
    setIsChecking(true);
    setErrorMessage('');
    try {
      const organization = await api.get(`/public/organizations/${code}`);
      rememberOrganization(organization, 'staff');
      queryClient.setQueryData(['organization-branding', code], organization);
      navigate(`/signin/${code}/welcome`);
    } catch (error) {
      setErrorMessage(error.status === 404 ? "We couldn't find an organisation with that code. Check it with your employer." : error.message);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <AuthLayout backTo="/welcome">
      <div className="auth-heading">
        <span className="auth-heading__icon"><KeyRound size={20} /></span>
        <h2>Enter your organisation code</h2>
        <p className="muted">Your employer shares this code with you. You only need it once on this device.</p>
      </div>
      <form className="auth-form" onSubmit={submit} noValidate>
        <FormField label="Organisation code" error={errorMessage}>
          <input
            className="input input--code mono"
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="ABC-12345"
            value={code}
            onChange={(event) => {
              setCode(formatCode(event.target.value));
              setErrorMessage('');
            }}
          />
        </FormField>
        <Button type="submit" icon={ArrowRight} isLoading={isChecking} disabled={!code}>Continue</Button>
      </form>
      <p className="auth-footnote auth-footnote--center">
        Own the organisation? <Link to="/organization/signin">Sign in as organisation</Link>
      </p>
    </AuthLayout>
  );
}
