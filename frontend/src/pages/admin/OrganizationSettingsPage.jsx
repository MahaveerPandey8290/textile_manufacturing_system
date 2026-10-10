import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { LogoUpload } from '../../components/auth/LogoUpload';
import { OrganizationCodeCard } from '../../components/auth/OrganizationCodeCard';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField, fieldErrorsFrom } from '../../components/ui/FormField';
import { PageHeader } from '../../components/ui/PageHeader';
import { SkeletonRows } from '../../components/ui/Spinner';
import { useApiMutation, useApiQuery } from '../../hooks/useApi';
import { formatDate } from '../../utils/format';

/** The owner's view of their organisation: brand, contact details and the code to share. */
export default function OrganizationSettingsPage() {
  const { refreshSession } = useAuth();
  const { data: profile, isLoading } = useApiQuery('/organization');
  const [form, setForm] = useState(null);
  const [logoChange, setLogoChange] = useState(undefined); // undefined = untouched, '' = removed

  useEffect(() => {
    if (profile) setForm({ name: profile.name, city: profile.city, phone: profile.phone ?? '', gstNumber: profile.gstNumber ?? '' });
  }, [profile]);

  const save = useApiMutation({
    method: 'patch',
    path: '/organization',
    invalidate: ['/organization'],
    successMessage: 'Organisation details saved',
    onSuccess: async () => {
      setLogoChange(undefined);
      await refreshSession(); // the sidebar and sign-in screens pick up the new name/logo
    },
  });
  const errors = fieldErrorsFrom(save.error);

  if (isLoading || !form) return <SkeletonRows rows={6} />;
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <div className="stack">
      <PageHeader title="Organisation" description={`Registered ${formatDate(profile.createdAt)} · staff sign in with @${profile.emailDomain} addresses`} />
      <OrganizationCodeCard />
      <Card title="Brand and details" subtitle="Your logo and name appear on your team's sign-in screens and across the app.">
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate({ body: { ...form, ...(logoChange !== undefined ? { logo: logoChange || null } : {}) } });
          }}
        >
          <div className="span-all">
            <LogoUpload value={logoChange !== undefined ? logoChange : profile.logoUrl ?? ''} onChange={setLogoChange} organizationName={form.name} error={errors.logo} />
          </div>
          <FormField label="Organisation name" error={errors.name}><input className="input" required value={form.name} onChange={update('name')} /></FormField>
          <FormField label="City" error={errors.city}><input className="input" required value={form.city} onChange={update('city')} /></FormField>
          <FormField label="Phone" hint="Optional" error={errors.phone}><input className="input" type="tel" value={form.phone} onChange={update('phone')} /></FormField>
          <FormField label="GSTIN" hint="Optional" error={errors.gstNumber}>
            <input className="input mono" maxLength={15} value={form.gstNumber} onChange={(event) => setForm((current) => ({ ...current, gstNumber: event.target.value.toUpperCase() }))} />
          </FormField>
          <div className="span-all row" style={{ justifyContent: 'flex-end' }}>
            <Button type="submit" icon={Save} isLoading={save.isPending}>Save changes</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
