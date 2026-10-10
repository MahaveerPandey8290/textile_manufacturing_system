import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { DataTable, Pagination } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Tabs } from '../../components/ui/Tabs';
import { useListState } from '../../components/ui/useListState';
import { useApiQuery } from '../../hooks/useApi';
import { formatDate, formatNumber, formatRelative, formatRupeesShort } from '../../utils/format';
import { OrganizationCell } from './PlatformOverviewPage';

const STATUS_TABS = [
  { id: '', label: 'All' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'SUSPENDED', label: 'Suspended' },
];

export default function OrganizationsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? '';
  const list = useListState();
  const { data, isLoading, isFetching, error, refetch } = useApiQuery('/platform/organizations', { ...list.queryParams, status: status || undefined });

  return (
    <>
      <PageHeader eyebrow="Platform" title="Organisations" description="Every mill on the platform. Open one to see its people and activity, or to suspend it." />
      <Card padded={false}>
        <div className="toolbar toolbar--padded">
          <Tabs tabs={STATUS_TABS} activeTab={status} onChange={(next) => { setSearchParams(next ? { status: next } : {}); list.setPage(1); }} />
          <SearchInput value={list.searchText} onChange={list.setSearchText} placeholder="Search name, code, city or domain" isSearching={list.isDebouncing || isFetching} />
        </div>
        <DataTable
          rows={data?.items}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          onRowClick={(organization) => navigate(`/platform/organizations/${organization.id}`)}
          emptyTitle="No organisations match"
          columns={[
            { key: 'name', header: 'Organisation', render: (organization) => <OrganizationCell organization={organization} /> },
            { key: 'city', header: 'City', render: (organization) => <><div>{organization.city}</div><div className="cell-sub">@{organization.email_domain}</div></> },
            {
              key: 'people',
              header: 'People',
              align: 'right',
              render: (organization) => (
                <>
                  <div>{formatNumber(organization.active_user_count)}</div>
                  {organization.invited_user_count > 0 && <div className="cell-sub">{organization.invited_user_count} invited</div>}
                </>
              ),
            },
            { key: 'open_order_count', header: 'Open orders', align: 'right' },
            { key: 'machine_count', header: 'Machines', align: 'right' },
            { key: 'revenue_this_month', header: 'Invoiced (month)', align: 'right', render: (organization) => formatRupeesShort(organization.revenue_this_month) },
            { key: 'last_sign_in_at', header: 'Last sign-in', render: (organization) => formatRelative(organization.last_sign_in_at) },
            { key: 'created_at', header: 'Joined', render: (organization) => formatDate(organization.created_at) },
            { key: 'status', header: 'Status', render: (organization) => <StatusBadge status={organization.status} /> },
          ]}
        />
        {data && <div className="card__body"><Pagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPageChange={list.setPage} /></div>}
      </Card>
    </>
  );
}
