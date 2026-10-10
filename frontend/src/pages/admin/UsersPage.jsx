import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { OrganizationCodeCard } from '../../components/auth/OrganizationCodeCard';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable, Pagination } from '../../components/ui/DataTable';
import { FormField, fieldErrorsFrom } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useListState } from '../../components/ui/useListState';
import { ROLE_LABELS } from '../../config/navigation';
import { useApiMutation, useApiQuery } from '../../hooks/useApi';
import { useBuyers } from '../../hooks/useLookups';
import { formatRelative } from '../../utils/format';

export default function UsersPage() {
  const list = useListState();
  const [isAdding, setIsAdding] = useState(false);
  const { data, isLoading, isFetching, error } = useApiQuery('/users', list.queryParams);
  const toggleActive = useApiMutation({ method: 'patch', path: '/users', invalidate: ['/users'], successMessage: 'User updated' });
  return (
    <div className="stack">
      <PageHeader title="Users & roles" description="Who can sign in and what they can see. Every role only sees its own part of the mill." actions={<Button icon={UserPlus} onClick={() => setIsAdding(true)}>Invite person</Button>} />
      <OrganizationCodeCard />
      <Card>
        <div className="toolbar">
          <SearchInput value={list.searchText} onChange={list.setSearchText} placeholder="Search name or email" isSearching={list.isDebouncing || isFetching} />
        </div>
        <DataTable
          rows={data?.items}
          isLoading={isLoading}
          error={error}
          columns={[
            { key: 'full_name', header: 'Name', render: (user) => <><div className="cell-title">{user.full_name}</div><div className="cell-sub">{user.email}</div></> },
            { key: 'role', header: 'Role', render: (user) => <><span className="chip">{ROLE_LABELS[user.role]}</span>{user.buyer_company && <div className="cell-sub">{user.buyer_company}</div>}</> },
            { key: 'last_login_at', header: 'Last sign-in', render: (user) => formatRelative(user.last_login_at) },
            { key: 'status', header: 'Status', render: (user) => <StatusBadge status={user.status} label={user.status === 'INVITED' ? 'Invited, not set up' : undefined} /> },
            {
              key: 'action',
              header: '',
              render: (user) =>
                user.role !== 'OWNER' && (
                  <Button size="sm" variant="ghost" onClick={() => toggleActive.mutate({ path: `/users/${user.id}`, body: { isActive: !user.is_active } })}>
                    {user.is_active ? 'Disable' : 'Enable'}
                  </Button>
                ),
            },
          ]}
        />
        {data && <Pagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPageChange={list.setPage} />}
      </Card>
      <AddUserModal isOpen={isAdding} onClose={() => setIsAdding(false)} />
    </div>
  );
}

const EMPTY_USER = { fullName: '', email: '', role: 'PRODUCTION_MANAGER', buyerId: '' };

/** Invite: no password here. The person verifies their email and picks their own password. */
function AddUserModal({ isOpen, onClose }) {
  const { organization } = useAuth();
  const [user, setUser] = useState(EMPTY_USER);
  const { data: buyers } = useBuyers();
  const create = useApiMutation({
    path: '/users',
    invalidate: ['/users'],
    successMessage: 'Invitation sent. They finish set-up from “First time here?” on the sign-in screen.',
    onSuccess: () => {
      setUser(EMPTY_USER);
      onClose();
    },
  });
  const fieldErrors = fieldErrorsFrom(create.error);
  const updateField = (field) => (event) => setUser((current) => ({ ...current, [field]: event.target.value }));
  const isBuyer = user.role === 'BUYER';
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invite a person"
      subtitle={`They'll get an email with the organisation code ${organization.code} and how to set up their account.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="add-user-form" icon={UserPlus} isLoading={create.isPending}>Send invitation</Button>
        </>
      }
    >
      <form
        id="add-user-form"
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate({ body: { ...user, buyerId: isBuyer ? Number(user.buyerId) : undefined } });
        }}
      >
        <FormField label="Full name" error={fieldErrors.fullName}><input className="input" required value={user.fullName} onChange={updateField('fullName')} /></FormField>
        <FormField label="Role">
          <select className="select" value={user.role} onChange={updateField('role')}>
            {Object.entries(ROLE_LABELS).map(([role, label]) => <option key={role} value={role}>{label}</option>)}
          </select>
        </FormField>
        <FormField
          label={isBuyer ? 'Buyer\'s company email' : 'Work email'}
          className="span-all"
          error={fieldErrors.email}
          hint={isBuyer ? 'Their own company address. Personal Gmail or Yahoo addresses are not accepted.' : `Staff must use an @${organization.emailDomain} address.`}
        >
          <input className="input" type="email" required placeholder={isBuyer ? 'name@buyercompany.com' : `name@${organization.emailDomain}`} value={user.email} onChange={updateField('email')} />
        </FormField>
        {isBuyer && (
          <FormField label="Buyer company" className="span-all">
            <select className="select" required value={user.buyerId} onChange={updateField('buyerId')}>
              <option value="">Choose…</option>
              {buyers?.items.map((buyer) => <option key={buyer.id} value={buyer.id}>{buyer.company_name}</option>)}
            </select>
          </FormField>
        )}
      </form>
    </Modal>
  );
}
