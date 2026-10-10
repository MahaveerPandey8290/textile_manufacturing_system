import { Ban, Building2, IndianRupee, ShieldAlert, ShoppingBag, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { OrganizationMark } from '../../components/auth/OrganizationMark';
import { EventLine } from '../../components/platform/PlatformShell';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { ErrorState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { FullPageSpinner } from '../../components/ui/Spinner';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useApiQuery } from '../../hooks/useApi';
import { formatNumber, formatRelative, formatRupeesShort } from '../../utils/format';

/** Super admin home: the health of the whole platform at a glance. */
export default function PlatformOverviewPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useApiQuery('/platform/overview', undefined, { refetchInterval: 60_000 });
  if (isLoading) return <FullPageSpinner />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const { organizations, totals, lastSevenDays, signups, topOrganizations, recentEvents } = data;
  const chartData = signups.map((row) => ({ ...row, label: new Date(`${row.day}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }));

  return (
    <div className="stack">
      <PageHeader eyebrow="Platform" title="Overview" description="Every organisation on the platform, how much they use it, and what just happened." />

      <div className="grid grid--stats">
        <StatCard label="Organisations" value={organizations.total} hint={`${organizations.new_last_30_days} new in the last 30 days`} icon={Building2} onClick={() => navigate('/platform/organizations')} />
        <StatCard label="Suspended" value={organizations.suspended} hint={`${organizations.active} active`} icon={Ban} tone={organizations.suspended ? 'danger' : 'success'} onClick={() => navigate('/platform/organizations?status=SUSPENDED')} />
        <StatCard label="People with access" value={formatNumber(totals.activeUsers)} hint={`${formatNumber(lastSevenDays.people_signed_in)} signed in this week`} icon={Users} tone="teal" />
        <StatCard label="Open orders" value={formatNumber(totals.openOrders)} hint={`${formatNumber(totals.orders)} orders in total`} icon={ShoppingBag} tone="purple" />
        <StatCard label="Invoiced this month" value={formatRupeesShort(totals.revenueThisMonth)} hint="Across active organisations" icon={IndianRupee} tone="success" />
        <StatCard label="Failed sign-ins" value={formatNumber(lastSevenDays.failed_sign_ins)} hint={`Last 7 days · ${formatNumber(lastSevenDays.sign_ins)} successful`} icon={ShieldAlert} tone={lastSevenDays.failed_sign_ins > 10 ? 'danger' : 'warning'} onClick={() => navigate('/platform/activity?eventType=SIGN_IN_FAILED')} />
      </div>

      <div className="grid grid--main-side grid--align-start">
        <Card title="New organisations" subtitle="Sign-ups per day, last 30 days">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1f6" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="#8a94a6" interval={4} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} stroke="#8a94a6" />
              <Tooltip formatter={(value) => [value, 'sign-ups']} cursor={{ fill: '#f4f6fa' }} />
              <Bar dataKey="signups" fill="#3b5bdb" radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Latest activity" actions={<a href="/platform/activity" onClick={(event) => { event.preventDefault(); navigate('/platform/activity'); }}>View all</a>}>
          <ul className="event-feed">
            {recentEvents.slice(0, 5).map((event) => <EventLine key={event.id} event={event} />)}
          </ul>
        </Card>
      </div>

      <Card title="Busiest organisations" subtitle="By open orders" padded={false}>
        <DataTable
          rows={topOrganizations}
          onRowClick={(organization) => navigate(`/platform/organizations/${organization.id}`)}
          columns={[
            { key: 'name', header: 'Organisation', render: (organization) => <OrganizationCell organization={organization} /> },
            { key: 'city', header: 'City' },
            { key: 'active_user_count', header: 'People', align: 'right', render: (organization) => formatNumber(organization.active_user_count) },
            { key: 'open_order_count', header: 'Open orders', align: 'right' },
            { key: 'revenue_this_month', header: 'Invoiced (month)', align: 'right', render: (organization) => formatRupeesShort(organization.revenue_this_month) },
            { key: 'last_sign_in_at', header: 'Last sign-in', render: (organization) => formatRelative(organization.last_sign_in_at) },
            { key: 'status', header: 'Status', render: (organization) => <StatusBadge status={organization.status} /> },
          ]}
        />
      </Card>
    </div>
  );
}

export function OrganizationCell({ organization }) {
  return (
    <div className="row" style={{ gap: 10 }}>
      <OrganizationMark name={organization.name} logoUrl={organization.logo_url} size={32} />
      <div>
        <div className="cell-title">{organization.name}</div>
        <div className="cell-sub mono">{organization.organization_code}</div>
      </div>
    </div>
  );
}
