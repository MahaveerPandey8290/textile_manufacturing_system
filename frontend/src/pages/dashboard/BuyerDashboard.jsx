import { Link2, PackageCheck, ShoppingBag, Truck, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useApiQuery } from '../../hooks/useApi';
import { formatDate, formatNumber, formatRupeesShort } from '../../utils/format';

export function BuyerDashboard() {
  const { currentUser, organization } = useAuth();
  const navigate = useNavigate();
  const { data: dashboard } = useApiQuery('/dashboard');
  const { data: orders, isLoading, error } = useApiQuery('/orders', { pageSize: 10 });
  const summary = dashboard?.buyer;

  return (
    <div className="stack">
      <PageHeader
        eyebrow={currentUser.buyerCompany}
        title={`Your orders at ${organization.name}`}
        description="Live status straight from the mill floor. No need to call; everything you'd ask about is here."
      />
      <div className="grid grid--stats">
        <StatCard label="Open orders" value={summary?.open_orders ?? '—'} icon={ShoppingBag} />
        <StatCard label="Ready to ship" value={summary?.ready_to_dispatch ?? '—'} icon={PackageCheck} tone="teal" />
        <StatCard label="Shipped" value={summary?.shipped_orders ?? '—'} icon={Truck} tone="success" />
        <StatCard label="Amount due" value={formatRupeesShort(summary?.amount_due)} icon={Wallet} tone="warning" onClick={() => navigate('/invoices')} />
      </div>
      <Card title="Orders" subtitle="Click an order to see its timeline, rolls and deliveries" padded={false}>
        <DataTable
          isLoading={isLoading}
          error={error}
          rows={orders?.items}
          onRowClick={(order) => navigate(`/orders/${order.id}`)}
          columns={[
            { key: 'order_number', header: 'Order', render: (order) => <><div className="cell-title">{order.order_number}</div><div className="cell-sub">{order.fabric_name} · {order.colour}</div></> },
            { key: 'quantity', header: 'Quantity', render: (order) => formatNumber(order.quantity_meters, 'm') },
            {
              key: 'progress',
              header: 'Progress',
              width: 220,
              render: (order) => (
                <ProgressBar
                  max={order.quantity_meters}
                  segments={[
                    { label: 'Delivered', value: order.dispatched_meters, tone: 'success' },
                    { label: 'Checked, packed', value: order.passed_meters - order.dispatched_meters, tone: 'teal' },
                    { label: 'Woven', value: Math.max(0, order.produced_meters - order.passed_meters), tone: 'brand' },
                  ]}
                />
              ),
            },
            { key: 'due_date', header: 'Due', render: (order) => formatDate(order.due_date) },
            { key: 'status', header: 'Status', render: (order) => <StatusBadge status={order.status} /> },
          ]}
        />
      </Card>
      <div className="callout callout--info">
        <Link2 size={16} /> Each order page has a shareable tracking link you can forward to your team, no login needed.
      </div>
    </div>
  );
}
