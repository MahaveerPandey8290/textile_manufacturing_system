import { BarChart3, ClipboardCheck, Plus, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable, Pagination } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Tabs } from '../../components/ui/Tabs';
import { useListState } from '../../components/ui/useListState';
import { DEFECT_LABELS, STATUS_STYLES } from '../../config/statuses';
import { useApiQuery } from '../../hooks/useApi';
import { formatDateTime, formatNumber, formatRelative } from '../../utils/format';
import { InspectRollModal } from './InspectRollModal';
import { NewRollModal } from './NewRollModal';
import { RollTraceModal } from './RollTraceModal';

export default function QualityPage() {
  const { hasRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tracedRollId = searchParams.get('roll');
  const [activeTab, setActiveTab] = useState('queue');
  const [inspectingRoll, setInspectingRoll] = useState(null);
  const [isAddingRoll, setIsAddingRoll] = useState(false);
  const { data: summary } = useApiQuery('/quality/summary', { days: 30 });
  const canInspect = hasRole('QUALITY_INSPECTOR');
  const openTrace = (roll) => setSearchParams({ roll: roll.id });

  return (
    <>
      <PageHeader
        title="Quality control"
        description="Every roll checked before packing, every defect traceable to its order and loom."
        actions={hasRole('PRODUCTION_MANAGER') && <Button icon={Plus} onClick={() => setIsAddingRoll(true)}>New roll</Button>}
      />
      <div className="stack">
        <div className="grid grid--stats">
          <StatCard label="Waiting for check" value={summary?.waiting_for_check ?? '—'} hint="pending + rework" icon={ClipboardCheck} tone="warning" onClick={() => setActiveTab('queue')} />
          <StatCard label="Pass rate (30 d)" value={summary?.passRate !== null && summary ? `${summary.passRate}%` : '—'} hint={`${summary?.inspections ?? 0} inspections`} icon={BarChart3} tone="success" />
          <StatCard label="Sent for rework" value={summary?.rework ?? '—'} hint="last 30 days" tone="purple" />
          <StatCard label="Rejected" value={summary?.rejected ?? '—'} hint="last 30 days" tone="danger" />
        </div>
        <Card padded={false}>
          <div className="card__body">
            <Tabs
              activeTab={activeTab}
              onChange={setActiveTab}
              tabs={[
                { id: 'queue', label: 'Inspection queue', icon: ClipboardCheck, count: summary?.waiting_for_check },
                { id: 'rolls', label: 'All rolls', icon: ScrollText },
                { id: 'defects', label: 'Defect analysis', icon: BarChart3 },
              ]}
            />
            {activeTab === 'queue' && <InspectionQueue canInspect={canInspect} onInspect={setInspectingRoll} onTrace={openTrace} />}
            {activeTab === 'rolls' && <AllRolls onTrace={openTrace} />}
            {activeTab === 'defects' && <DefectAnalysis summary={summary} />}
          </div>
        </Card>
      </div>
      <InspectRollModal roll={inspectingRoll} onClose={() => setInspectingRoll(null)} />
      <NewRollModal isOpen={isAddingRoll} onClose={() => setIsAddingRoll(false)} />
      <RollTraceModal rollId={tracedRollId} onClose={() => setSearchParams({})} />
    </>
  );
}

const rollColumns = [
  { key: 'roll_number', header: 'Roll', render: (roll) => <><div className="mono strong">{roll.roll_number}</div><div className="cell-sub">{formatRelative(roll.created_at)}</div></> },
  { key: 'order', header: 'Order', render: (roll) => <><div>{roll.order_number}</div><div className="cell-sub">{roll.buyer_name}</div></> },
  { key: 'fabric', header: 'Fabric', render: (roll) => <><div>{roll.fabric_name}</div><div className="cell-sub">{roll.colour}</div></> },
  { key: 'machine_code', header: 'Loom', render: (roll) => <span className="chip">{roll.machine_code}</span> },
  { key: 'length_meters', header: 'Length', align: 'right', render: (roll) => formatNumber(roll.length_meters, 'm') },
];

function InspectionQueue({ canInspect, onInspect, onTrace }) {
  const [page, setPage] = useState(1);
  const pending = useApiQuery('/quality/rolls', { status: 'PENDING_QC', page, pageSize: 15 });
  const rework = useApiQuery('/quality/rolls', { status: 'REWORK', pageSize: 50 });
  const rows = [...(rework.data?.items ?? []), ...(pending.data?.items ?? [])];
  return (
    <>
      <DataTable
        rows={rows}
        isLoading={pending.isLoading}
        error={pending.error}
        onRowClick={onTrace}
        emptyTitle="Queue is clear"
        emptyDescription="Every roll that came off the looms has been checked."
        columns={[
          ...rollColumns,
          { key: 'status', header: 'Status', render: (roll) => <StatusBadge status={roll.status} /> },
          ...(canInspect ? [{ key: 'action', header: '', render: (roll) => <Button size="sm" onClick={(event) => { event.stopPropagation(); onInspect(roll); }}>Inspect</Button> }] : []),
        ]}
      />
      {pending.data && <Pagination page={pending.data.page} totalPages={pending.data.totalPages} totalCount={pending.data.totalCount + (rework.data?.totalCount ?? 0)} onPageChange={setPage} />}
    </>
  );
}

function AllRolls({ onTrace }) {
  const list = useListState();
  const [status, setStatus] = useState('');
  const { data, isLoading, isFetching, error } = useApiQuery('/quality/rolls', { ...list.queryParams, status: status || undefined });
  return (
    <>
      <div className="toolbar">
        <SearchInput value={list.searchText} onChange={list.setSearchText} placeholder="Search roll no., order or buyer" isSearching={list.isDebouncing || isFetching} />
        <select className="select select-sm" value={status} onChange={(event) => { setStatus(event.target.value); list.setPage(1); }} aria-label="Roll status">
          <option value="">All statuses</option>
          {['PENDING_QC', 'PASSED', 'REWORK', 'REJECTED', 'DISPATCHED'].map((value) => <option key={value} value={value}>{STATUS_STYLES[value].label}</option>)}
        </select>
      </div>
      <DataTable
        rows={data?.items}
        isLoading={isLoading}
        error={error}
        onRowClick={onTrace}
        columns={[
          ...rollColumns,
          { key: 'grade', header: 'Grade', render: (roll) => roll.grade ?? '—' },
          { key: 'inspected_at', header: 'Checked', render: (roll) => formatDateTime(roll.inspected_at) },
          { key: 'status', header: 'Status', render: (roll) => <StatusBadge status={roll.status} /> },
        ]}
      />
      {data && <Pagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPageChange={list.setPage} />}
    </>
  );
}

function DefectAnalysis({ summary }) {
  if (!summary) return null;
  const chartData = summary.defectsByType.map((row) => ({ name: DEFECT_LABELS[row.defect_type], occurrences: row.occurrences }));
  return (
    <div className="grid grid--2">
      <Card title="Most common defects" subtitle="Last 30 days. Fix the top bar first.">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 30, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef1f6" />
            <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={12} width={120} />
            <Tooltip cursor={{ fill: '#f4f6fa' }} />
            <Bar dataKey="occurrences" fill="#ef6820" radius={[0, 4, 4, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Defects by machine" subtitle="Where quality problems come from">
        <DataTable
          rows={summary.defectsByMachine}
          rowKey="machine_code"
          columns={[
            { key: 'machine_code', header: 'Machine', render: (row) => <span className="chip">{row.machine_code}</span> },
            { key: 'inspections', header: 'Rolls checked', align: 'right' },
            { key: 'failed', header: 'Failed', align: 'right', render: (row) => <span className={row.failed ? 'text-danger strong' : ''}>{row.failed}</span> },
            { key: 'defect_count', header: 'Defects', align: 'right' },
          ]}
        />
      </Card>
    </div>
  );
}
