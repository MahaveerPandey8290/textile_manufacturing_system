import { useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { DataTable, Pagination } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { useListState } from '../../components/ui/useListState';
import { PLATFORM_EVENTS, describeEvent } from '../../config/platformEvents';
import { useApiQuery } from '../../hooks/useApi';
import { formatDateTime } from '../../utils/format';

/** Everything that happened across the platform, newest first, filterable by type. */
export default function PlatformActivityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const eventType = searchParams.get('eventType') ?? '';
  const organizationId = searchParams.get('organizationId') ?? undefined;
  const list = useListState({ pageSize: 25 });
  const { data, isLoading, isFetching, error, refetch } = useApiQuery('/platform/events', { ...list.queryParams, eventType: eventType || undefined, organizationId });

  return (
    <>
      <PageHeader eyebrow="Platform" title="Activity" description="Sign-ups, sign-ins, password resets and suspensions across every organisation." />
      <Card padded={false}>
        <div className="toolbar toolbar--padded">
          <select
            className="select"
            style={{ maxWidth: 240 }}
            value={eventType}
            aria-label="Event type"
            onChange={(event) => {
              const next = new URLSearchParams(searchParams);
              if (event.target.value) next.set('eventType', event.target.value); else next.delete('eventType');
              setSearchParams(next);
              list.setPage(1);
            }}
          >
            <option value="">All events</option>
            {Object.entries(PLATFORM_EVENTS).map(([type, meta]) => <option key={type} value={type}>{meta.label}</option>)}
          </select>
          {organizationId && (
            <button type="button" className="chip chip--action" onClick={() => { const next = new URLSearchParams(searchParams); next.delete('organizationId'); setSearchParams(next); list.setPage(1); }}>
              {data?.items?.[0]?.organization_name ?? 'One organisation'} ✕
            </button>
          )}
          <SearchInput value={list.searchText} onChange={list.setSearchText} placeholder="Search email or organisation" isSearching={list.isDebouncing || isFetching} />
        </div>
        <DataTable
          rows={data?.items}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          emptyTitle="No events match"
          columns={[
            {
              key: 'event_type',
              header: 'Event',
              render: (event) => {
                const meta = describeEvent(event.event_type);
                return (
                  <span className="row" style={{ gap: 8 }}>
                    <span className={`event-line__icon tone-${meta.tone}`}><meta.icon size={14} /></span>
                    <strong>{meta.label}</strong>
                  </span>
                );
              },
            },
            { key: 'organization_name', header: 'Organisation', render: (event) => event.organization_name ?? <span className="muted">Platform</span> },
            { key: 'actor_email', header: 'Who', render: (event) => event.actor_email ?? '—' },
            { key: 'details', header: 'Details', render: (event) => <span className="cell-sub">{event.details?.reason ?? event.details?.invited ?? (event.details?.role ? event.details.role.replaceAll('_', ' ').toLowerCase() : '')}</span> },
            { key: 'ip_address', header: 'IP', render: (event) => <span className="mono cell-sub">{event.ip_address ?? '—'}</span> },
            { key: 'created_at', header: 'When', render: (event) => formatDateTime(event.created_at) },
          ]}
        />
        {data && <div className="card__body"><Pagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPageChange={list.setPage} /></div>}
      </Card>
    </>
  );
}
