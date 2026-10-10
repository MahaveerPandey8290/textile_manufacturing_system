import { Download, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable, Pagination } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { SearchInput } from '../../components/ui/SearchInput';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useListState } from '../../components/ui/useListState';
import { STATUS_STYLES } from '../../config/statuses';
import { useApiQuery } from '../../hooks/useApi';
import { exportCsv } from '../../utils/exportCsv';
import { daysUntil, formatCurrency, formatDate, formatNumber } from '../../utils/format';
import { NewOrderModal } from './NewOrderModal';

const STATUS_FILTERS = ['', 'NEW', 'IN_PRODUCTION', 'QUALITY_CHECK', 'READY_TO_DISPATCH', 'PARTIALLY_DISPATCHED', 'DISPATCHED', 'CANCELLED'];

export default function OrdersPage() {
  const navigate = useNavigate();
  const { currentUser, hasRole } = useAuth();
  const isBuyer = currentUser.role === 'BUYER';
  const [statusFilter, setStatusFilter] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const list = useListState();
  const { data, isLoading, isFetching, error, refetch } = useApiQuery('/orders', { ...list.queryParams, status: statusFilter || undefined });

  const columns = [
    {
      key: 'order_number',
      header: 'Order',
      render: (order) => (
        <>
          <div className="cell-title">{order.order_number}</div>
          <div className="cell-sub">{isBuyer ? order.fabric_name : order.buyer_name}</div>
        </>
      ),
    },
    { key: 'fabric', header: 'Fabric', render: (order) => <><div>{order.fabric_name}</div><div className="cell-sub">{order.colour}</div></> },
    { key: 'quantity', header: 'Qty', align: 'right', render: (order) => formatNumber(order.quantity_meters, 'm') },
    {
      key: 'progress',
      header: 'Progress',
      width: 190,
      render: (order) => (
        <ProgressBar
          max={order.quantity_meters}
          segments={[
            { label: 'Dispatched', value: order.dispatched_meters, tone: 'success' },
            { label: 'Passed QC', value: order.passed_meters - order.dispatched_meters, tone: 'teal' },
            { label: 'Woven', value: Math.max(0, order.produced_meters - order.passed_meters), tone: 'brand' },
          ]}
        />
      ),
    },
    {
      key: 'due',
      header: 'Due',
      render: (order) => {
        const days = daysUntil(order.due_date);
        return (
          <>
            <div>{formatDate(order.due_date)}</div>
            {order.is_overdue ? <div className="cell-sub text-danger">{-days} days late</div> : <div className="cell-sub">{days >= 0 && !['DISPATCHED', 'CANCELLED'].includes(order.status) ? `in ${days} d` : ''}</div>}
          </>
        );
      },
    },
    { key: 'priority', header: 'Priority', render: (order) => <StatusBadge status={order.priority} /> },
    ...(isBuyer ? [] : [{ key: 'value', header: 'Value', align: 'right', render: (order) => formatCurrency(order.quantity_meters * order.rate_per_meter) }]),
    { key: 'status', header: 'Status', render: (order) => <StatusBadge status={order.status} /> },
  ];

  return (
    <>
      <PageHeader
        title={isBuyer ? 'My orders' : 'Orders'}
        description={isBuyer ? 'Everything you have ordered from us, live.' : 'Every buyer order, its progress on the floor and its due date.'}
        actions={
          <>
            <Button
              variant="secondary"
              icon={Download}
              disabled={!data?.items?.length}
              onClick={() =>
                exportCsv('orders', [
                  { header: 'Order', value: (order) => order.order_number },
                  { header: 'Buyer', value: (order) => order.buyer_name },
                  { header: 'Fabric', value: (order) => order.fabric_name },
                  { header: 'Colour', value: (order) => order.colour },
                  { header: 'Meters', value: (order) => order.quantity_meters },
                  { header: 'Passed meters', value: (order) => order.passed_meters },
                  { header: 'Dispatched meters', value: (order) => order.dispatched_meters },
                  { header: 'Due date', value: (order) => order.due_date },
                  { header: 'Status', value: (order) => order.status },
                ], data.items)
              }
            >
              Export
            </Button>
            {hasRole('PRODUCTION_MANAGER', 'ACCOUNTANT') && (
              <Button icon={Plus} onClick={() => setIsCreating(true)}>
                New order
              </Button>
            )}
          </>
        }
      />
      <Card padded={false}>
        <div className="card__body">
          <div className="toolbar">
            <SearchInput value={list.searchText} onChange={list.setSearchText} placeholder="Search order no., buyer, fabric or colour" isSearching={list.isDebouncing || isFetching} />
            <select className="select select-sm" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); list.setPage(1); }} aria-label="Filter by status">
              {STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>{status ? STATUS_STYLES[status].label : 'All statuses'}</option>
              ))}
            </select>
          </div>
          <DataTable
            columns={columns}
            rows={data?.items}
            isLoading={isLoading}
            error={error}
            onRetry={refetch}
            onRowClick={(order) => navigate(`/orders/${order.id}`)}
            rowClassName={(order) => (order.is_overdue ? 'is-alert' : '')}
            emptyTitle="No orders match"
            emptyDescription="Try a different search or status."
          />
          {data && <Pagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPageChange={list.setPage} />}
        </div>
      </Card>
      <NewOrderModal isOpen={isCreating} onClose={() => setIsCreating(false)} onCreated={(order) => navigate(`/orders/${order.id}`)} />
    </>
  );
}
