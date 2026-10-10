import { CalendarCheck, Plus, Users, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable, Pagination } from '../../components/ui/DataTable';
import { FormField, fieldErrorsFrom } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Tabs } from '../../components/ui/Tabs';
import { useListState } from '../../components/ui/useListState';
import { STAGE_LABELS } from '../../config/statuses';
import { useApiMutation, useApiQuery } from '../../hooks/useApi';
import { formatCurrency, formatDate } from '../../utils/format';
import { AttendanceRegister } from './AttendanceRegister';
import { PayrollPanel } from './PayrollPanel';

export default function WorkforcePage() {
  const { hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState('attendance');
  return (
    <>
      <PageHeader title="Workforce" description="Attendance register, workers and monthly wages. The register book, without the book." />
      <Card padded={false}>
        <div className="card__body">
          <Tabs
            activeTab={activeTab}
            onChange={setActiveTab}
            tabs={[
              { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
              { id: 'workers', label: 'Workers', icon: Users },
              { id: 'payroll', label: 'Wages', icon: Wallet },
            ]}
          />
          {activeTab === 'attendance' && <AttendanceRegister canEdit={hasRole('PRODUCTION_MANAGER')} />}
          {activeTab === 'workers' && <WorkersTable canEdit={hasRole('PRODUCTION_MANAGER')} />}
          {activeTab === 'payroll' && <PayrollPanel canManage={hasRole('ACCOUNTANT')} />}
        </div>
      </Card>
    </>
  );
}

function WorkersTable({ canEdit }) {
  const list = useListState({ pageSize: 20 });
  const [isAdding, setIsAdding] = useState(false);
  const { data, isLoading, isFetching, error } = useApiQuery('/workforce/workers', list.queryParams);
  return (
    <>
      <div className="toolbar">
        <SearchInput value={list.searchText} onChange={list.setSearchText} placeholder="Search name, code or phone" isSearching={list.isDebouncing || isFetching} />
        {canEdit && <Button icon={Plus} size="sm" onClick={() => setIsAdding(true)} className="push-right">Add worker</Button>}
      </div>
      <DataTable
        rows={data?.items}
        isLoading={isLoading}
        error={error}
        columns={[
          { key: 'full_name', header: 'Worker', render: (worker) => <><div className="cell-title">{worker.full_name}</div><div className="cell-sub mono">{worker.employee_code}</div></> },
          { key: 'department', header: 'Department', render: (worker) => STAGE_LABELS[worker.department] ?? 'General' },
          { key: 'designation', header: 'Role' },
          { key: 'phone', header: 'Phone' },
          { key: 'daily_wage', header: 'Daily wage', align: 'right', render: (worker) => formatCurrency(worker.daily_wage) },
          { key: 'joined_on', header: 'Joined', render: (worker) => formatDate(worker.joined_on) },
          { key: 'today_status', header: 'Today', render: (worker) => (worker.today_status ? <StatusBadge status={worker.today_status} /> : <span className="muted">Not marked</span>) },
        ]}
      />
      {data && <Pagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPageChange={list.setPage} />}
      <AddWorkerModal isOpen={isAdding} onClose={() => setIsAdding(false)} />
    </>
  );
}

const EMPTY_WORKER = { employeeCode: '', fullName: '', phone: '', department: '', designation: 'Operator', dailyWage: '' };

function AddWorkerModal({ isOpen, onClose }) {
  const [worker, setWorker] = useState(EMPTY_WORKER);
  const addWorker = useApiMutation({
    path: '/workforce/workers',
    invalidate: ['/workforce'],
    successMessage: 'Worker added',
    onSuccess: () => {
      setWorker(EMPTY_WORKER);
      onClose();
    },
  });
  const fieldErrors = fieldErrorsFrom(addWorker.error);
  const updateField = (field) => (event) => setWorker((current) => ({ ...current, [field]: event.target.value }));
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add worker"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="add-worker-form" isLoading={addWorker.isPending}>Add worker</Button>
        </>
      }
    >
      <form
        id="add-worker-form"
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          addWorker.mutate({ body: { ...worker, department: worker.department || null, phone: worker.phone || null, dailyWage: Number(worker.dailyWage) } });
        }}
      >
        <FormField label="Employee code" error={fieldErrors.employeeCode}><input className="input" required value={worker.employeeCode} onChange={updateField('employeeCode')} placeholder="EMP-033" /></FormField>
        <FormField label="Full name" error={fieldErrors.fullName}><input className="input" required value={worker.fullName} onChange={updateField('fullName')} /></FormField>
        <FormField label="Phone"><input className="input" value={worker.phone} onChange={updateField('phone')} /></FormField>
        <FormField label="Department">
          <select className="select" value={worker.department} onChange={updateField('department')}>
            <option value="">General / packing / store</option>
            {Object.entries(STAGE_LABELS).map(([stage, label]) => <option key={stage} value={stage}>{label}</option>)}
          </select>
        </FormField>
        <FormField label="Designation"><input className="input" required value={worker.designation} onChange={updateField('designation')} /></FormField>
        <FormField label="Daily wage (₹)" error={fieldErrors.dailyWage}><input className="input" type="number" min="0" required value={worker.dailyWage} onChange={updateField('dailyWage')} /></FormField>
      </form>
    </Modal>
  );
}
