import { BadgeIndianRupee, Download, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useApiMutation, useApiQuery } from '../../hooks/useApi';
import { exportCsv } from '../../utils/exportCsv';
import { currentMonthIso, formatCurrency, formatDate, formatNumber } from '../../utils/format';

/** Monthly wages computed from the attendance register: days × daily wage + overtime at 1.5×. */
export function PayrollPanel({ canManage }) {
  const [month, setMonth] = useState(currentMonthIso());
  const [openRunId, setOpenRunId] = useState(null);
  const { data: runs, isLoading, error } = useApiQuery('/workforce/payroll');
  const generate = useApiMutation({ path: '/workforce/payroll', invalidate: ['/workforce', '/reports'], successMessage: (run) => `Payroll for ${run.month} ready: ${formatCurrency(run.total_net_pay)}` });

  return (
    <>
      {canManage && (
        <div className="toolbar">
          <input className="input select-sm" type="month" value={month} max={currentMonthIso()} onChange={(event) => setMonth(event.target.value)} aria-label="Payroll month" />
          <Button icon={RefreshCw} isLoading={generate.isPending} onClick={() => generate.mutate({ body: { month } })}>Generate payroll</Button>
          <span className="muted" style={{ fontSize: 12 }}>Re-generating a draft picks up attendance corrections. Paid months are locked.</span>
        </div>
      )}
      <DataTable
        rows={runs}
        isLoading={isLoading}
        error={error}
        onRowClick={(run) => setOpenRunId(run.id)}
        emptyTitle="No payroll generated yet"
        columns={[
          { key: 'month', header: 'Month', render: (run) => <strong>{new Date(`${run.month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</strong> },
          { key: 'worker_count', header: 'Workers', align: 'right' },
          { key: 'total_net_pay', header: 'Net pay', align: 'right', render: (run) => <strong>{formatCurrency(run.total_net_pay)}</strong> },
          { key: 'generated_at', header: 'Generated', render: (run) => formatDate(run.generated_at) },
          { key: 'status', header: 'Status', render: (run) => <StatusBadge status={run.status} /> },
        ]}
      />
      <PayslipsModal runId={openRunId} canManage={canManage} onClose={() => setOpenRunId(null)} />
    </>
  );
}

function PayslipsModal({ runId, canManage, onClose }) {
  const { data: run, isLoading } = useApiQuery(`/workforce/payroll/${runId}`, undefined, { enabled: Boolean(runId) });
  const markPaid = useApiMutation({ path: `/workforce/payroll/${runId}/mark-paid`, invalidate: ['/workforce', '/reports', '/dashboard'], successMessage: 'Wages marked as paid' });
  return (
    <Modal
      isOpen={Boolean(runId)}
      onClose={onClose}
      size="lg"
      title={run ? `Payroll · ${run.month}` : 'Payroll'}
      subtitle={run ? `${run.payslips.length} workers · ${formatCurrency(run.total_net_pay)}` : undefined}
      footer={
        run && (
          <>
            <Button
              variant="secondary"
              icon={Download}
              onClick={() =>
                exportCsv(`payroll-${run.month}`, [
                  { header: 'Employee code', value: (slip) => slip.employee_code },
                  { header: 'Name', value: (slip) => slip.full_name },
                  { header: 'Days', value: (slip) => slip.days_present },
                  { header: 'OT hours', value: (slip) => slip.overtime_hours },
                  { header: 'Daily wage', value: (slip) => slip.daily_wage },
                  { header: 'Basic', value: (slip) => slip.basic_pay },
                  { header: 'Overtime pay', value: (slip) => slip.overtime_pay },
                  { header: 'Net pay', value: (slip) => slip.net_pay },
                ], run.payslips)
              }
            >
              Export for bank
            </Button>
            {canManage && run.status === 'DRAFT' && (
              <Button icon={BadgeIndianRupee} variant="success" isLoading={markPaid.isPending} onClick={() => markPaid.mutate({ body: {} })}>Mark as paid</Button>
            )}
          </>
        )
      }
    >
      <DataTable
        rows={run?.payslips}
        isLoading={isLoading}
        columns={[
          { key: 'full_name', header: 'Worker', render: (slip) => <><div className="cell-title">{slip.full_name}</div><div className="cell-sub mono">{slip.employee_code}</div></> },
          { key: 'days_present', header: 'Days', align: 'right' },
          { key: 'overtime_hours', header: 'OT h', align: 'right' },
          { key: 'daily_wage', header: 'Daily wage', align: 'right', render: (slip) => formatCurrency(slip.daily_wage) },
          { key: 'basic_pay', header: 'Basic', align: 'right', render: (slip) => formatNumber(slip.basic_pay) },
          { key: 'overtime_pay', header: 'Overtime', align: 'right', render: (slip) => formatNumber(slip.overtime_pay) },
          { key: 'net_pay', header: 'Net pay', align: 'right', render: (slip) => <strong>{formatCurrency(slip.net_pay)}</strong> },
        ]}
      />
    </Modal>
  );
}
