import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField, fieldErrorsFrom } from '../../components/ui/FormField';
import { PageHeader } from '../../components/ui/PageHeader';
import { ROLE_LABELS } from '../../config/navigation';
import { useApiMutation } from '../../hooks/useApi';

export default function AccountPage() {
  const { currentUser } = useAuth();
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const changePassword = useApiMutation({
    path: '/auth/change-password',
    successMessage: 'Password changed',
    onSuccess: () => setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' }),
  });
  const fieldErrors = fieldErrorsFrom(changePassword.error);
  const mismatch = passwords.confirmPassword && passwords.confirmPassword !== passwords.newPassword;
  const updateField = (field) => (event) => setPasswords((current) => ({ ...current, [field]: event.target.value }));
  return (
    <>
      <PageHeader title="My account" />
      <div className="grid grid--2">
        <Card title="Profile">
          <dl className="key-values">
            <div><dt>Name</dt><dd>{currentUser.fullName}</dd></div>
            <div><dt>Email</dt><dd>{currentUser.email}</dd></div>
            <div><dt>Role</dt><dd>{ROLE_LABELS[currentUser.role]}</dd></div>
            {currentUser.buyerCompany && <div><dt>Company</dt><dd>{currentUser.buyerCompany}</dd></div>}
          </dl>
        </Card>
        <Card title="Change password">
          <form
            className="stack"
            style={{ gap: 14 }}
            onSubmit={(event) => {
              event.preventDefault();
              changePassword.mutate({ body: { currentPassword: passwords.currentPassword, newPassword: passwords.newPassword } });
            }}
          >
            <FormField label="Current password"><input className="input" type="password" autoComplete="current-password" required value={passwords.currentPassword} onChange={updateField('currentPassword')} /></FormField>
            <FormField label="New password" hint="At least 10 characters, with a letter and a number" error={fieldErrors.newPassword}>
              <input className="input" type="password" autoComplete="new-password" required minLength={10} value={passwords.newPassword} onChange={updateField('newPassword')} />
            </FormField>
            <FormField label="Confirm new password" error={mismatch ? 'Passwords do not match' : undefined}>
              <input className="input" type="password" autoComplete="new-password" required value={passwords.confirmPassword} onChange={updateField('confirmPassword')} />
            </FormField>
            <div><Button type="submit" isLoading={changePassword.isPending} disabled={mismatch}>Update password</Button></div>
          </form>
        </Card>
      </div>
    </>
  );
}
