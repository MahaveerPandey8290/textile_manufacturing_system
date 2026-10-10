import { Card } from '../../components/ui/Card';
import { DataTable, Pagination } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { useListState } from '../../components/ui/useListState';
import { useApiQuery } from '../../hooks/useApi';
import { formatDateTime, humanize } from '../../utils/format';

export default function AuditLogPage() {
  const list = useListState({ pageSize: 25 });
  const { data, isLoading, isFetching, error } = useApiQuery('/audit', list.queryParams);
  return (
    <>
      <PageHeader title="Audit log" description="Who changed what, and when. Every stock movement, dispatch, payment and status change is recorded." />
      <Card>
        <div className="toolbar">
          <SearchInput value={list.searchText} onChange={list.setSearchText} placeholder="Search action, record type or person" isSearching={list.isDebouncing || isFetching} />
        </div>
        <DataTable
          rows={data?.items}
          isLoading={isLoading}
          error={error}
          columns={[
            { key: 'created_at', header: 'When', render: (entry) => <span className="nowrap">{formatDateTime(entry.created_at)}</span> },
            { key: 'user_name', header: 'Who', render: (entry) => entry.user_name ?? 'System' },
            { key: 'action', header: 'Action', render: (entry) => <strong>{humanize(entry.action)}</strong> },
            { key: 'entity', header: 'Record', render: (entry) => <span className="chip">{entry.entity_type}{entry.entity_id ? ` #${entry.entity_id}` : ''}</span> },
            { key: 'details', header: 'Details', render: (entry) => <span className="mono soft" style={{ fontSize: 12 }}>{entry.details ? JSON.stringify(entry.details).slice(0, 120) : ''}</span> },
            { key: 'ip_address', header: 'IP', render: (entry) => <span className="muted">{entry.ip_address}</span> },
          ]}
        />
        {data && <Pagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPageChange={list.setPage} />}
      </Card>
    </>
  );
}
