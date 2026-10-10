import { PackageOpen, Truck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useApiQuery } from '../../hooks/useApi';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '../../utils/format';
import { NewDispatchModal } from './NewDispatchModal';

export default function DispatchPage() {
  const { currentUser, hasRole } = useAuth();
  const isBuyer = currentUser.role === 'BUYER';
  const [activeTab, setActiveTab] = useState(isBuyer ? 'history' : 'shelf');
  const [loadingOrder, setLoadingOrder] = useState(null);
  const { data: shelf } = useApiQuery('/dispatches/finished-stock', undefined, { enabled: !isBuyer });
  const metersOnShelf = shelf?.reduce((sum, row) => sum + row.meters_on_shelf, 0) ?? 0;
  const rollsOnShelf = shelf?.reduce((sum, row) => sum + row.rolls_on_shelf, 0) ?? 0;

  return (
    <>
      <PageHeader
        title={isBuyer ? 'Deliveries' : 'Finished goods & dispatch'}
        description={isBuyer ? 'Every truck we have sent you, with its delivery challan and invoice.' : 'What is on the shelf, what has gone out, and nothing dispatched twice.'}
      />
      <div className="stack">
        {!isBuyer && (
          <div className="grid grid--stats">
            <StatCard label="On the shelf" value={formatNumber(metersOnShelf, 'm')} hint={`${rollsOnShelf} passed rolls`} icon={PackageOpen} tone="teal" />
            <StatCard label="Orders ready to load" value={shelf?.length ?? '—'} icon={Truck} />
          </div>
        )}
        <Card padded={false}>
          <div className="card__body">
            {!isBuyer && (
              <Tabs
                activeTab={activeTab}
                onChange={setActiveTab}
                tabs={[
                  { id: 'shelf', label: 'On the shelf', icon: PackageOpen, count: shelf?.length },
                  { id: 'history', label: 'Dispatched', icon: Truck },
                ]}
              />
            )}
            {activeTab === 'shelf' && (
              <DataTable
                rows={shelf}
                rowKey="order_id"
                emptyTitle="Shelf is empty"
                emptyDescription="Passed rolls show up here, grouped by order, ready to load."
                columns={[
                  { key: 'order_number', header: 'Order', render: (row) => <><div className="cell-title">{row.order_number}</div><div className="cell-sub">{row.buyer_name}</div></> },
                  { key: 'fabric', header: 'Fabric', render: (row) => <><div>{row.fabric_name}</div><div className="cell-sub">{row.colour}</div></> },
                  { key: 'rolls_on_shelf', header: 'Rolls', align: 'right' },
                  { key: 'meters_on_shelf', header: 'On shelf', align: 'right', render: (row) => <strong>{formatNumber(row.meters_on_shelf, 'm')}</strong> },
                  { key: 'dispatched_meters', header: 'Already sent', align: 'right', render: (row) => `${formatNumber(row.dispatched_meters)} / ${formatNumber(row.quantity_meters)} m` },
                  { key: 'rack_locations', header: 'Racks', render: (row) => row.rack_locations?.slice(0, 4).map((rack) => <span key={rack} className="chip" style={{ marginRight: 4 }}>{rack}</span>) },
                  { key: 'due_date', header: 'Due', render: (row) => formatDate(row.due_date) },
                  ...(hasRole('STORE_MANAGER') ? [{ key: 'action', header: '', render: (row) => <Button size="sm" icon={Truck} onClick={() => setLoadingOrder(row)}>Load truck</Button> }] : []),
                ]}
              />
            )}
            {activeTab === 'history' && <DispatchHistory showBuyer={!isBuyer} />}
          </div>
        </Card>
      </div>
      <NewDispatchModal order={loadingOrder} onClose={() => setLoadingOrder(null)} />
    </>
  );
}

function DispatchHistory({ showBuyer }) {
  const navigate = useNavigate();
  const list = useListState();
  const { data, isLoading, isFetching, error } = useApiQuery('/dispatches', list.queryParams);
  return (
    <>
      <div className="toolbar">
        <SearchInput value={list.searchText} onChange={list.setSearchText} placeholder="Search dispatch, order, buyer or truck" isSearching={list.isDebouncing || isFetching} />
      </div>
      <DataTable
        rows={data?.items}
        isLoading={isLoading}
        error={error}
        onRowClick={(dispatch) => navigate(`/dispatch/${dispatch.id}`)}
        emptyTitle="No dispatches yet"
        columns={[
          { key: 'dispatch_number', header: 'Dispatch', render: (dispatch) => <><div className="mono strong">{dispatch.dispatch_number}</div><div className="cell-sub">{formatDateTime(dispatch.dispatched_at)}</div></> },
          { key: 'order', header: 'Order', render: (dispatch) => <><div>{dispatch.order_number}</div>{showBuyer && <div className="cell-sub">{dispatch.buyer_name}</div>}</> },
          { key: 'vehicle_number', header: 'Truck', render: (dispatch) => <><div>{dispatch.vehicle_number}</div><div className="cell-sub">{dispatch.driver_name}</div></> },
          { key: 'total_rolls', header: 'Rolls', align: 'right' },
          { key: 'total_meters', header: 'Meters', align: 'right', render: (dispatch) => formatNumber(dispatch.total_meters) },
          { key: 'invoice', header: 'Invoice', render: (dispatch) => <><div className="mono">{dispatch.invoice_number}</div><div className="cell-sub">{formatCurrency(dispatch.total_amount)}</div></> },
          { key: 'invoice_status', header: 'Payment', render: (dispatch) => <StatusBadge status={dispatch.invoice_status} /> },
        ]}
      />
      {data && <Pagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPageChange={list.setPage} />}
    </>
  );
}
