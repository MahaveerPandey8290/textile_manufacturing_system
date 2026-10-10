import { Cog, Download, Factory, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Tabs } from '../../components/ui/Tabs';
import { STAGE_LABELS } from '../../config/statuses';
import { useApiQuery } from '../../hooks/useApi';
import { exportCsv } from '../../utils/exportCsv';
import { currentMonthIso, formatCurrency, formatNumber, todayIso } from '../../utils/format';

export default function ReportsPage() {
  const { hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState('costing');
  return (
    <>
      <PageHeader title="Reports" description="What each order really cost, what every machine produced, and what was paid in wages." />
      <Card padded={false}>
        <div className="card__body">
          <Tabs
            activeTab={activeTab}
            onChange={setActiveTab}
            tabs={[
              { id: 'costing', label: 'Order costing', icon: Cog },
              { id: 'machines', label: 'Machine output', icon: Factory },
              ...(hasRole('ACCOUNTANT') ? [{ id: 'wages', label: 'Wages by department', icon: Users }] : []),
            ]}
          />
          {activeTab === 'costing' && <OrderCostingReport />}
          {activeTab === 'machines' && <MachineOutputReport />}
          {activeTab === 'wages' && <WageReport />}
        </div>
      </Card>
    </>
  );
}

function OrderCostingReport() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useApiQuery('/reports/order-costing');
  return (
    <>
      <div className="toolbar">
        <span className="soft">Cost = yarn issued (at weighted average cost) + operator wages + machine running cost, from real floor entries.</span>
        <Button
          size="sm"
          variant="secondary"
          icon={Download}
          disabled={!data?.length}
          onClick={() =>
            exportCsv('order-costing', [
              { header: 'Order', value: (row) => row.order_number },
              { header: 'Buyer', value: (row) => row.buyer_name },
              { header: 'Order value', value: (row) => row.order_value },
              { header: 'Yarn', value: (row) => row.material_cost },
              { header: 'Labour', value: (row) => row.labour_cost },
              { header: 'Machine', value: (row) => row.machine_cost },
              { header: 'Total cost', value: (row) => row.total_cost },
              { header: 'Cost per meter', value: (row) => row.cost_per_meter },
              { header: 'Projected margin', value: (row) => row.projected_margin },
            ], data)
          }
        >
          CSV
        </Button>
      </div>
      <DataTable
        rows={data}
        isLoading={isLoading}
        error={error}
        onRowClick={(row) => navigate(`/orders/${row.id}`)}
        columns={[
          { key: 'order_number', header: 'Order', render: (row) => <><div className="cell-title">{row.order_number}</div><div className="cell-sub">{row.buyer_name} · {row.fabric_name}</div></> },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
          { key: 'order_value', header: 'Value', align: 'right', render: (row) => formatCurrency(row.order_value) },
          { key: 'material_cost', header: 'Yarn', align: 'right', render: (row) => formatCurrency(row.material_cost) },
          { key: 'labour_cost', header: 'Labour', align: 'right', render: (row) => formatCurrency(row.labour_cost) },
          { key: 'machine_cost', header: 'Machine', align: 'right', render: (row) => formatCurrency(row.machine_cost) },
          { key: 'total_cost', header: 'Total cost', align: 'right', render: (row) => <strong>{formatCurrency(row.total_cost)}</strong> },
          { key: 'cost_per_meter', header: '₹ / meter', align: 'right', render: (row) => (row.cost_per_meter ? `${formatCurrency(row.cost_per_meter)} vs ${formatCurrency(row.rate_per_meter)}` : '—') },
          { key: 'projected_margin', header: 'Margin', align: 'right', render: (row) => <strong className={row.projected_margin < 0 ? 'text-danger' : 'text-success'}>{formatCurrency(row.projected_margin)}</strong> },
        ]}
      />
    </>
  );
}

function MachineOutputReport() {
  const thirtyDaysAgo = new Date(Date.now() - 29 * 86_400_000).toLocaleDateString('en-CA');
  const [range, setRange] = useState({ from: thirtyDaysAgo, to: todayIso() });
  const { data, isLoading, error } = useApiQuery('/reports/machine-output', range);
  return (
    <div className="stack">
      <div className="toolbar">
        <input className="input select-sm" type="date" value={range.from} max={range.to} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} aria-label="From" />
        <span className="muted">to</span>
        <input className="input select-sm" type="date" value={range.to} max={todayIso()} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} aria-label="To" />
      </div>
      {data && (
        <Card title="Utilisation by machine" subtitle="Hours run as a share of available hours (24 h/day)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} margin={{ left: -16, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1f6" />
              <XAxis dataKey="code" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis unit="%" tickLine={false} axisLine={false} fontSize={12} domain={[0, 100]} />
              <Tooltip formatter={(value) => [`${value}%`, 'utilisation']} cursor={{ fill: '#f4f6fa' }} />
              <Bar dataKey="utilisation_percent" radius={[4, 4, 0, 0]} maxBarSize={32}>
                {data.map((row) => <Cell key={row.id} fill={row.utilisation_percent >= 60 ? '#12b76a' : row.utilisation_percent >= 30 ? '#f79009' : '#f04438'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
      <DataTable
        rows={data}
        isLoading={isLoading}
        error={error}
        columns={[
          { key: 'code', header: 'Machine', render: (row) => <><div className="cell-title">{row.code}</div><div className="cell-sub">{row.name}</div></> },
          { key: 'stage', header: 'Stage', render: (row) => STAGE_LABELS[row.stage] },
          { key: 'quantity_produced', header: 'Produced', align: 'right', render: (row) => <strong>{formatNumber(row.quantity_produced, row.quantity_unit)}</strong> },
          { key: 'hours_run', header: 'Hours run', align: 'right', render: (row) => formatNumber(row.hours_run) },
          { key: 'downtime_hours', header: 'Downtime h', align: 'right', render: (row) => <span className={row.downtime_hours ? 'text-danger' : ''}>{formatNumber(row.downtime_hours)}</span> },
          { key: 'breakdown_count', header: 'Stops', align: 'right' },
          { key: 'running_cost', header: 'Running cost', align: 'right', render: (row) => formatCurrency(row.running_cost) },
          { key: 'utilisation_percent', header: 'Utilisation', width: 160, render: (row) => <ProgressBar value={row.utilisation_percent} showLabel tone={row.utilisation_percent >= 60 ? 'success' : 'warning'} /> },
        ]}
      />
    </div>
  );
}

function WageReport() {
  const [month, setMonth] = useState(currentMonthIso());
  const { data, isLoading, error } = useApiQuery('/reports/wages', { month });
  const total = data?.reduce((sum, row) => sum + row.net_pay, 0) ?? 0;
  return (
    <>
      <div className="toolbar">
        <input className="input select-sm" type="month" value={month} max={currentMonthIso()} onChange={(event) => setMonth(event.target.value)} aria-label="Month" />
        <span className="soft">Total {formatCurrency(total)}</span>
      </div>
      <DataTable
        rows={data}
        rowKey="department"
        isLoading={isLoading}
        error={error}
        emptyTitle="Payroll not generated for this month"
        emptyDescription="Generate it from Workforce → Wages."
        columns={[
          { key: 'department', header: 'Department', render: (row) => <strong>{STAGE_LABELS[row.department] ?? 'General & packing'}</strong> },
          { key: 'workers', header: 'Workers', align: 'right' },
          { key: 'days_worked', header: 'Days worked', align: 'right', render: (row) => formatNumber(row.days_worked) },
          { key: 'overtime_hours', header: 'Overtime h', align: 'right', render: (row) => formatNumber(row.overtime_hours) },
          { key: 'net_pay', header: 'Wages', align: 'right', render: (row) => <strong>{formatCurrency(row.net_pay)}</strong> },
        ]}
      />
    </>
  );
}
