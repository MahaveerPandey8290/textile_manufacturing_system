import { Building2, Plus, Truck } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable, Pagination } from '../../components/ui/DataTable';
import { FormField, fieldErrorsFrom } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { Tabs } from '../../components/ui/Tabs';
import { useListState } from '../../components/ui/useListState';
import { useApiMutation, useApiQuery } from '../../hooks/useApi';
import { formatCurrency, formatDate } from '../../utils/format';

const PARTY_CONFIG = {
  buyers: { label: 'Buyer', writers: ['ACCOUNTANT', 'PRODUCTION_MANAGER'] },
  suppliers: { label: 'Supplier', writers: ['ACCOUNTANT', 'STORE_MANAGER'] },
};

export default function PartiesPage() {
  const [activeTab, setActiveTab] = useState('buyers');
  return (
    <>
      <PageHeader title="Buyers & suppliers" description="Who we sell to, who we buy yarn from, and where the money stands with each." />
      <Card padded={false}>
        <div className="card__body">
          <Tabs activeTab={activeTab} onChange={setActiveTab} tabs={[{ id: 'buyers', label: 'Buyers', icon: Building2 }, { id: 'suppliers', label: 'Suppliers', icon: Truck }]} />
          <PartyTable key={activeTab} kind={activeTab} />
        </div>
      </Card>
    </>
  );
}

function PartyTable({ kind }) {
  const { hasRole } = useAuth();
  const list = useListState();
  const [isAdding, setIsAdding] = useState(false);
  const { data, isLoading, isFetching, error } = useApiQuery(`/${kind}`, list.queryParams);
  const config = PARTY_CONFIG[kind];
  return (
    <>
      <div className="toolbar">
        <SearchInput value={list.searchText} onChange={list.setSearchText} placeholder={`Search ${kind} by name, contact or phone`} isSearching={list.isDebouncing || isFetching} />
        {hasRole(...config.writers) && <Button size="sm" icon={Plus} onClick={() => setIsAdding(true)}>Add {config.label.toLowerCase()}</Button>}
      </div>
      <DataTable
        rows={data?.items}
        isLoading={isLoading}
        error={error}
        columns={[
          { key: 'company_name', header: config.label, render: (party) => <><div className="cell-title">{party.company_name}</div><div className="cell-sub">{party.address}</div></> },
          { key: 'contact', header: 'Contact', render: (party) => <><div>{party.contact_person ?? '—'}</div><div className="cell-sub">{party.phone}</div></> },
          { key: 'email', header: 'Email', render: (party) => party.email ?? '—' },
          { key: 'gst_number', header: 'GSTIN', render: (party) => <span className="mono">{party.gst_number ?? '—'}</span> },
          kind === 'buyers'
            ? { key: 'open_orders', header: 'Open orders', align: 'right' }
            : { key: 'last_delivery_at', header: 'Last delivery', render: (party) => formatDate(party.last_delivery_at) },
          { key: 'outstanding_amount', header: kind === 'buyers' ? 'They owe us' : 'We owe them', align: 'right', render: (party) => <strong>{formatCurrency(party.outstanding_amount)}</strong> },
        ]}
      />
      {data && <Pagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPageChange={list.setPage} />}
      <AddPartyModal kind={kind} isOpen={isAdding} onClose={() => setIsAdding(false)} />
    </>
  );
}

const EMPTY_PARTY = { companyName: '', contactPerson: '', phone: '', email: '', gstNumber: '', address: '' };

function AddPartyModal({ kind, isOpen, onClose }) {
  const [party, setParty] = useState(EMPTY_PARTY);
  const label = PARTY_CONFIG[kind].label;
  const create = useApiMutation({
    path: `/${kind}`,
    invalidate: [`/${kind}`],
    successMessage: `${label} added`,
    onSuccess: () => {
      setParty(EMPTY_PARTY);
      onClose();
    },
  });
  const fieldErrors = fieldErrorsFrom(create.error);
  const updateField = (field) => (event) => setParty((current) => ({ ...current, [field]: event.target.value }));
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Add ${label.toLowerCase()}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="add-party-form" isLoading={create.isPending}>Save</Button>
        </>
      }
    >
      <form id="add-party-form" className="form-grid" onSubmit={(event) => { event.preventDefault(); create.mutate({ body: party }); }}>
        <FormField label="Company name" className="span-all" error={fieldErrors.companyName}><input className="input" required value={party.companyName} onChange={updateField('companyName')} /></FormField>
        <FormField label="Contact person"><input className="input" value={party.contactPerson} onChange={updateField('contactPerson')} /></FormField>
        <FormField label="Phone" error={fieldErrors.phone}><input className="input" value={party.phone} onChange={updateField('phone')} /></FormField>
        <FormField label="Email" error={fieldErrors.email}><input className="input" type="email" value={party.email} onChange={updateField('email')} /></FormField>
        <FormField label="GSTIN"><input className="input" value={party.gstNumber} onChange={updateField('gstNumber')} maxLength={20} /></FormField>
        <FormField label="Address" className="span-all"><textarea className="textarea" value={party.address} onChange={updateField('address')} /></FormField>
      </form>
    </Modal>
  );
}
