import { Factory, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { FormField } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { SkeletonRows } from '../../components/ui/Spinner';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Tabs } from '../../components/ui/Tabs';
import { STAGE_LABELS } from '../../config/statuses';
import { useApiMutation, useApiQuery } from '../../hooks/useApi';
import { formatCurrency, formatDate, formatDateTime, formatNumber, todayIso } from '../../utils/format';
import { LogOutputModal } from './LogOutputModal';
import { MachineCard } from './MachineCard';
import { NewMachineModal } from './NewMachineModal';
import { PlanJobModal } from './PlanJobModal';

const STAGE_FILTERS = [['', 'All stages'], ...Object.entries(STAGE_LABELS)];

export default function ProductionPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canOperate = hasRole('PRODUCTION_MANAGER');
  const [activeTab, setActiveTab] = useState('board');
  const [stageFilter, setStageFilter] = useState('');
  const [loggingMachine, setLoggingMachine] = useState(null);
  const [breakdownMachine, setBreakdownMachine] = useState(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isAddingMachine, setIsAddingMachine] = useState(false);

  // The board refreshes every 30 s so a supervisor's screen stays truthful without anyone walking the floor.
  const { data: board, isLoading } = useApiQuery('/production/machines', undefined, { refetchInterval: 30_000 });
  const { data: jobs } = useApiQuery('/production/jobs', undefined, { refetchInterval: 30_000 });

  const nextJobByMachine = useMemo(() => {
    const queue = new Map();
    jobs?.filter((job) => job.status === 'PLANNED' || job.status === 'ON_HOLD').forEach((job) => !queue.has(job.machine_id) && queue.set(job.machine_id, job));
    return queue;
  }, [jobs]);

  const changeJob = useApiMutation({ path: '/production/jobs', invalidate: ['/production', '/orders', '/dashboard'], successMessage: 'Job updated' });
  const changeMachineStatus = useApiMutation({ path: '/production/machines', invalidate: ['/production', '/dashboard'], successMessage: 'Machine status updated' });
  const runJobAction = (jobId, action) => changeJob.mutate({ path: `/production/jobs/${jobId}/${action}`, body: {} });
  const backInService = (machine) => changeMachineStatus.mutate({ path: `/production/machines/${machine.id}/status`, body: { status: 'IDLE' } });

  const machines = board?.machines.filter((machine) => !stageFilter || machine.stage === stageFilter) ?? [];
  const summary = board?.summary ?? {};

  return (
    <>
      <PageHeader
        title="Production floor"
        description="Which order is on which machine, how far along it is, and what is sitting idle. Live."
        actions={
          canOperate && (
            <>
              <Button variant="secondary" icon={Factory} onClick={() => setIsAddingMachine(true)}>New machine</Button>
              <Button icon={Plus} onClick={() => setIsPlanning(true)}>Plan job</Button>
            </>
          )
        }
      />
      <div className="grid grid--stats" style={{ marginBottom: 20 }}>
        {[
          ['RUNNING', 'Running', 'success'],
          ['IDLE', 'Idle', 'warning'],
          ['BREAKDOWN', 'Breakdown', 'danger'],
          ['MAINTENANCE', 'Maintenance', 'purple'],
        ].map(([status, label, tone]) => (
          <div key={status} className={`stat-card stat-card--${tone}`}>
            <div className="stat-card__top"><span className="stat-card__label">{label}</span></div>
            <div className="stat-card__value">{summary[status] ?? 0}</div>
          </div>
        ))}
      </div>
      <Card padded={false}>
        <div className="card__body">
          <Tabs
            activeTab={activeTab}
            onChange={setActiveTab}
            tabs={[
              { id: 'board', label: 'Machine board', icon: Factory },
              { id: 'jobs', label: 'Job queue', count: jobs?.filter((job) => job.status !== 'COMPLETED').length },
              { id: 'logs', label: 'Output log' },
              { id: 'downtime', label: 'Downtime' },
            ]}
          />
          {activeTab === 'board' && (
            <>
              <div className="toolbar">
                <div className="segmented">
                  {STAGE_FILTERS.map(([stage, label]) => (
                    <button key={stage} className={stageFilter === stage ? 'is-active' : ''} onClick={() => setStageFilter(stage)}>{label}</button>
                  ))}
                </div>
                <span className="muted" style={{ fontSize: 12 }}>Auto-refreshes every 30 seconds</span>
              </div>
              {isLoading ? (
                <SkeletonRows />
              ) : board?.machines.length === 0 ? (
                <EmptyState
                  icon={Factory}
                  title="No machines yet"
                  description="Add each spinning frame, loom and dyeing machine so jobs can be planned on them."
                  action={canOperate && <Button icon={Plus} onClick={() => setIsAddingMachine(true)}>New machine</Button>}
                />
              ) : (
                <div className="machine-board">
                  {machines.map((machine) => (
                    <MachineCard
                      key={machine.id}
                      machine={machine}
                      nextJob={nextJobByMachine.get(machine.id)}
                      canOperate={canOperate}
                      onLogOutput={setLoggingMachine}
                      onJobAction={runJobAction}
                      onReportBreakdown={setBreakdownMachine}
                      onBackInService={backInService}
                    />
                  ))}
                </div>
              )}
            </>
          )}
          {activeTab === 'jobs' && (
            <DataTable
              rows={jobs}
              emptyTitle="No jobs planned"
              onRowClick={(job) => navigate(`/orders/${job.order_id}`)}
              columns={[
                { key: 'job_number', header: 'Job', render: (job) => <><div className="mono strong">{job.job_number}</div><div className="cell-sub">{STAGE_LABELS[job.stage]}</div></> },
                { key: 'order', header: 'Order', render: (job) => <><div className="cell-title">{job.order_number}</div><div className="cell-sub">{job.buyer_name} · {job.colour}</div></> },
                { key: 'machine', header: 'Machine', render: (job) => <span className="chip">{job.machine_code}</span> },
                { key: 'progress', header: 'Output', width: 200, render: (job) => <ProgressBar value={job.produced_quantity} max={job.planned_quantity} showLabel /> },
                { key: 'due_date', header: 'Order due', render: (job) => formatDate(job.due_date) },
                { key: 'status', header: 'Status', render: (job) => <StatusBadge status={job.status} /> },
                ...(canOperate
                  ? [{
                      key: 'actions',
                      header: '',
                      render: (job) => (
                        <div className="row" onClick={(event) => event.stopPropagation()}>
                          {(job.status === 'PLANNED' || job.status === 'ON_HOLD') && <Button size="sm" onClick={() => runJobAction(job.id, 'start')}>Start</Button>}
                          {job.status === 'IN_PROGRESS' && <Button size="sm" variant="secondary" onClick={() => runJobAction(job.id, 'complete')}>Complete</Button>}
                        </div>
                      ),
                    }]
                  : []),
              ]}
            />
          )}
          {activeTab === 'logs' && <OutputLogTab />}
          {activeTab === 'downtime' && <DowntimeTab />}
        </div>
      </Card>
      <PlanJobModal isOpen={isPlanning} onClose={() => setIsPlanning(false)} />
      <NewMachineModal isOpen={isAddingMachine} onClose={() => setIsAddingMachine(false)} />
      <LogOutputModal machine={loggingMachine} onClose={() => setLoggingMachine(null)} />
      <BreakdownModal machine={breakdownMachine} onClose={() => setBreakdownMachine(null)} />
    </>
  );
}

function OutputLogTab() {
  const [date, setDate] = useState(todayIso());
  const { data, isLoading, error } = useApiQuery('/production/logs', { date });
  const totalMeters = data?.filter((log) => log.quantity_unit === 'm').reduce((sum, log) => sum + log.quantity_produced, 0) ?? 0;
  return (
    <>
      <div className="toolbar">
        <input className="input select-sm" type="date" value={date} max={todayIso()} onChange={(event) => setDate(event.target.value)} aria-label="Date" />
        <span className="soft">{data?.length ?? 0} entries · {formatNumber(totalMeters, 'm')} woven/dyed</span>
      </div>
      <DataTable
        rows={data}
        isLoading={isLoading}
        error={error}
        emptyTitle="No output logged on this day"
        columns={[
          { key: 'logged_at', header: 'Time', render: (log) => formatDateTime(log.logged_at) },
          { key: 'machine_code', header: 'Machine', render: (log) => <span className="chip">{log.machine_code}</span> },
          { key: 'order_number', header: 'Order', render: (log) => <><div>{log.order_number}</div><div className="cell-sub mono">{log.job_number}</div></> },
          { key: 'worker_name', header: 'Operator', render: (log) => log.worker_name ?? '—' },
          { key: 'shift_name', header: 'Shift', render: (log) => log.shift_name ?? '—' },
          { key: 'quantity_produced', header: 'Output', align: 'right', render: (log) => <strong>{formatNumber(log.quantity_produced, log.quantity_unit)}</strong> },
          { key: 'hours_worked', header: 'Hours', align: 'right' },
          { key: 'cost', header: 'Labour + machine', align: 'right', render: (log) => formatCurrency(log.labour_cost + log.machine_cost) },
        ]}
      />
    </>
  );
}

function DowntimeTab() {
  const { data, isLoading, error } = useApiQuery('/production/downtimes');
  return (
    <DataTable
      rows={data}
      isLoading={isLoading}
      error={error}
      emptyTitle="No downtime in the last 30 days"
      columns={[
        { key: 'machine_code', header: 'Machine', render: (downtime) => <><span className="chip">{downtime.machine_code}</span> <span className="cell-sub">{downtime.machine_name}</span></> },
        { key: 'reason', header: 'Reason' },
        { key: 'started_at', header: 'Started', render: (downtime) => formatDateTime(downtime.started_at) },
        { key: 'ended_at', header: 'Ended', render: (downtime) => (downtime.ended_at ? formatDateTime(downtime.ended_at) : <StatusBadge status="BREAKDOWN" label="Still down" />) },
        { key: 'hours_down', header: 'Hours lost', align: 'right', render: (downtime) => <strong>{formatNumber(downtime.hours_down)}</strong> },
        { key: 'reported_by_name', header: 'Reported by', render: (downtime) => downtime.reported_by_name ?? '—' },
      ]}
    />
  );
}

function BreakdownModal({ machine, onClose }) {
  const [status, setStatus] = useState('BREAKDOWN');
  const [reason, setReason] = useState('');
  const report = useApiMutation({
    path: '/production/machines',
    invalidate: ['/production', '/dashboard'],
    successMessage: 'Machine marked as down. Its running job is on hold.',
    onSuccess: () => {
      setReason('');
      onClose();
    },
  });
  return (
    <Modal
      isOpen={Boolean(machine)}
      onClose={onClose}
      title={`Stop ${machine?.code}`}
      subtitle="The running job is put on hold so it can be moved to another machine."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" isLoading={report.isPending} onClick={() => report.mutate({ path: `/production/machines/${machine.id}/status`, body: { status, reason: reason || undefined } })}>
            Mark as down
          </Button>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <div className="segmented">
          <button className={status === 'BREAKDOWN' ? 'is-active' : ''} onClick={() => setStatus('BREAKDOWN')}>Breakdown</button>
          <button className={status === 'MAINTENANCE' ? 'is-active' : ''} onClick={() => setStatus('MAINTENANCE')}>Planned maintenance</button>
        </div>
        <FormField label="What happened?">
          <input className="input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Warp beam bearing noise" maxLength={300} />
        </FormField>
      </div>
    </Modal>
  );
}
