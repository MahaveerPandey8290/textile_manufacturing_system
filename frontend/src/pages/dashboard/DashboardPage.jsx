import { AlertTriangle, Boxes, CalendarClock, ClipboardCheck, Factory, IndianRupee, PackageCheck, ShoppingBag, Truck, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/EmptyState';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { SkeletonRows } from '../../components/ui/Spinner';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useApiQuery } from '../../hooks/useApi';
import { daysUntil, formatDate, formatNumber, formatRelative, formatRupeesShort, humanize } from '../../utils/format';
import { BuyerDashboard } from './BuyerDashboard';
import { OrderStatusDonut } from './OrderStatusDonut';
import { ProductionTrendChart } from './ProductionTrendChart';

const GREETING = () => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};

export default function DashboardPage() {
  const { currentUser } = useAuth();
  if (currentUser.role === 'BUYER') return <BuyerDashboard />;
  return <MillDashboard />;
}

function MillDashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  // Light polling keeps the floor numbers fresh on a wall-mounted screen.
  const { data: dashboard, isLoading, error, refetch } = useApiQuery('/dashboard', undefined, { refetchInterval: 60_000 });

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading) return <SkeletonRows rows={8} />;

  const { orders, machines, todayOutput, quality, lowStockYarns, upcomingDeliveries, finance, recentActivity, productionTrend } = dashboard;
  const totalMachines = Object.values(machines).reduce((sum, count) => sum + count, 0);
  const metersToday = todayOutput.filter((row) => row.quantity_unit === 'm' && row.stage === 'WEAVING').reduce((sum, row) => sum + row.quantity, 0);
  const role = currentUser.role;

  return (
    <div className="stack">
      <div className="hero-banner">
        <div>
          <h1>
            {GREETING()}, {currentUser.fullName.split(' ')[0]}
          </h1>
          <p>Here's the mill right now · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="hero-banner__stats">
          <div className="hero-banner__stat">
            <strong>{formatNumber(metersToday)} m</strong>
            <span>woven today</span>
          </div>
          <div className="hero-banner__stat">
            <strong>
              {machines.RUNNING ?? 0}/{totalMachines}
            </strong>
            <span>machines running</span>
          </div>
          <div className="hero-banner__stat">
            <strong>{orders.open_orders}</strong>
            <span>open orders</span>
          </div>
        </div>
      </div>

      <div className="grid grid--stats">
        <StatCard label="Open orders" value={orders.open_orders} hint={`${orders.due_this_week} due this week`} icon={ShoppingBag} onClick={() => navigate('/orders')} />
        <StatCard label="Overdue orders" value={orders.overdue_orders} hint="past due date, not delivered" icon={AlertTriangle} tone={orders.overdue_orders ? 'danger' : 'success'} onClick={() => navigate('/orders')} />
        <StatCard label="Ready to ship" value={orders.ready_to_dispatch} hint={`${formatNumber(quality.finished_meters_on_shelf)} m on the shelf`} icon={Truck} tone="teal" onClick={() => navigate('/dispatch')} />
        <StatCard label="Machines down" value={(machines.BREAKDOWN ?? 0) + (machines.MAINTENANCE ?? 0)} hint={`${machines.IDLE ?? 0} idle`} icon={Factory} tone={machines.BREAKDOWN ? 'danger' : 'warning'} onClick={() => navigate('/production')} />
        <StatCard label="Awaiting QC" value={quality.rolls_waiting_qc} hint={`${quality.pass_rate_30_days ?? '—'}% pass rate (30 d)`} icon={ClipboardCheck} tone="purple" onClick={() => navigate('/quality')} />
        <StatCard label="Low-stock yarns" value={lowStockYarns.length} hint="at or below reorder level" icon={Boxes} tone={lowStockYarns.length ? 'warning' : 'success'} onClick={() => navigate('/inventory')} />
        {finance && (
          <>
            <StatCard label="Receivable" value={formatRupeesShort(finance.receivables)} hint={`${formatRupeesShort(finance.overdue_receivables)} overdue`} icon={Wallet} tone="danger" onClick={() => navigate('/finance')} />
            <StatCard label="Revenue this month" value={formatRupeesShort(finance.revenue_this_month)} hint={`${formatRupeesShort(finance.collections_this_month)} collected`} icon={IndianRupee} tone="success" onClick={() => navigate('/reports')} />
          </>
        )}
      </div>

      <div className="grid grid--main-side">
        <Card title="Production, last 14 days" subtitle="Meters woven and dyed, kilograms spun">
          <ProductionTrendChart rows={productionTrend} />
        </Card>
        <Card title="Machines right now" actions={<button className="link-button" onClick={() => navigate('/production')}>Open floor board</button>}>
          <div className="machine-pills">
            {[
              ['RUNNING', 'Running', '--tone-success'],
              ['IDLE', 'Idle', '--tone-warning'],
              ['BREAKDOWN', 'Breakdown', '--tone-danger'],
              ['MAINTENANCE', 'Service', '--tone-purple'],
            ].map(([status, label, tone]) => (
              <div key={status} className="machine-pill" style={{ '--pill-bg': `var(${tone}-bg)`, '--pill-ink': `var(${tone}-ink)` }}>
                <strong>{machines[status] ?? 0}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <h3 style={{ fontSize: 13, margin: '18px 0 6px' }}>Output today</h3>
          <div className="list">
            {todayOutput.length === 0 && <span className="muted">Nothing logged yet this shift.</span>}
            {todayOutput.map((row) => (
              <div key={row.stage} className="list__item">
                <span>{humanize(row.stage)}</span>
                <strong>{formatNumber(row.quantity, row.quantity_unit)}</strong>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid--3">
        <Card title="Deliveries due soon" subtitle="Next 10 days and overdue">
          <div className="list">
            {upcomingDeliveries.length === 0 && <span className="muted">Nothing due in the next 10 days.</span>}
            {upcomingDeliveries.map((order) => {
              const days = daysUntil(order.due_date);
              return (
                <button key={order.id} className="list__item" style={{ border: 0, background: 'none', textAlign: 'left', borderBottom: '1px solid var(--color-line)' }} onClick={() => navigate(`/orders/${order.id}`)}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="cell-title">{order.order_number}</div>
                    <div className="cell-sub">{order.buyer_name}</div>
                    <ProgressBar value={order.passed_meters} max={order.quantity_meters} tone="success" />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <StatusBadge status={order.status} />
                    <div className={`cell-sub ${days < 0 ? 'text-danger' : ''}`}>{days < 0 ? `${-days} d late` : days === 0 ? 'due today' : `in ${days} d`}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
        <Card title="Orders by stage">
          <OrderStatusDonut byStatus={orders.by_status} />
        </Card>
        <Card title="Yarn running low" actions={<button className="link-button" onClick={() => navigate('/inventory')}>Yarn store</button>}>
          <div className="list">
            {lowStockYarns.length === 0 && (
              <div className="callout callout--success">
                <PackageCheck size={16} /> All yarns are above their reorder level.
              </div>
            )}
            {lowStockYarns.map((yarn) => (
              <div key={yarn.id} className="list__item">
                <div style={{ flex: 1 }}>
                  <div className="cell-title">{yarn.name}</div>
                  <div className="cell-sub">
                    {yarn.code} · {yarn.colour}
                  </div>
                  <ProgressBar value={yarn.current_stock_kg} max={yarn.reorder_level_kg * 2} tone="warning" />
                </div>
                <div className="right">
                  <strong className="text-warning">{formatNumber(yarn.current_stock_kg, 'kg')}</strong>
                  <div className="cell-sub">reorder at {formatNumber(yarn.reorder_level_kg)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {(finance || recentActivity) && (
        <div className="grid grid--2">
          {finance && (
            <Card title="Money position" subtitle="Live from invoices, payments and supplier bills">
              <dl className="key-values">
                <div><dt>Buyers owe us</dt><dd>{formatRupeesShort(finance.receivables)}</dd></div>
                <div><dt>We owe suppliers</dt><dd>{formatRupeesShort(finance.payables)}</dd></div>
                <div><dt>Billed this month</dt><dd>{formatRupeesShort(finance.revenue_this_month)}</dd></div>
                <div><dt>Collected this month</dt><dd>{formatRupeesShort(finance.collections_this_month)}</dd></div>
              </dl>
            </Card>
          )}
          {recentActivity && role === 'OWNER' && (
            <Card title="Recent activity" actions={<button className="link-button" onClick={() => navigate('/admin/audit')}>Audit log</button>}>
              {recentActivity.map((activity, index) => (
                <div key={index} className="activity-item">
                  <span className="activity-dot" />
                  <div style={{ flex: 1 }}>
                    <strong>{activity.user_name ?? 'System'}</strong> {humanize(activity.action).toLowerCase()}
                    <div className="cell-sub">{formatRelative(activity.created_at)}</div>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}
      <p className="muted" style={{ fontSize: 12 }}>
        <CalendarClock size={12} style={{ verticalAlign: -2 }} /> Updated {formatDate(new Date())} · refreshes every minute
      </p>
    </div>
  );
}
