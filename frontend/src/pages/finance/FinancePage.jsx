import { ArrowDownLeft, ArrowUpRight, Download, Scale } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable, Pagination } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Tabs } from '../../components/ui/Tabs';
import { useListState } from '../../components/ui/useListState';
import { useApiQuery } from '../../hooks/useApi';
import { exportCsv } from '../../utils/exportCsv';
import { formatCurrency, formatDate } from '../../utils/format';
import { ProfitAndLossPanel } from './ProfitAndLossPanel';
import { RecordPaymentModal } from './RecordPaymentModal';

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState('pnl');
  return (
    <>
      <PageHeader title="Finance" description="Yarn bills, worker wages and buyer payments in one place." />
      <Card padded={false}>
        <div className="card__body">
          <Tabs
            activeTab={activeTab}
            onChange={setActiveTab}
            tabs={[
              { id: 'pnl', label: 'Month-end', icon: Scale },
              { id: 'receivables', label: 'Buyer invoices', icon: ArrowDownLeft },
              { id: 'payables', label: 'Supplier bills', icon: ArrowUpRight },
            ]}
          />
          {activeTab === 'pnl' && <ProfitAndLossPanel />}
          {activeTab === 'receivables' && <InvoicesTable />}
          {activeTab === 'payables' && <SupplierBillsTable />}
        </div>
      </Card>
    </>
  );
}

export function InvoicesTable({ readOnly = false }) {
  const { hasRole } = useAuth();
  const list = useListState();
  const [status, setStatus] = useState('');
  const [payingInvoice, setPayingInvoice] = useState(null);
  const { data, isLoading, isFetching, error } = useApiQuery('/finance/invoices', { ...list.queryParams, status: status || undefined });
  const canRecord = !readOnly && hasRole('ACCOUNTANT');
  return (
    <>
      <div className="toolbar">
        <SearchInput value={list.searchText} onChange={list.setSearchText} placeholder="Search invoice, order or buyer" isSearching={list.isDebouncing || isFetching} />
        <div className="segmented">
          {[['', 'All'], ['UNPAID', 'Unpaid'], ['PARTIALLY_PAID', 'Part paid'], ['PAID', 'Paid']].map(([value, label]) => (
            <button key={value} className={status === value ? 'is-active' : ''} onClick={() => { setStatus(value); list.setPage(1); }}>{label}</button>
          ))}
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={Download}
          disabled={!data?.items?.length}
          onClick={() =>
            exportCsv('invoices', [
              { header: 'Invoice', value: (invoice) => invoice.invoice_number },
              { header: 'Date', value: (invoice) => invoice.invoice_date },
              { header: 'Buyer', value: (invoice) => invoice.buyer_name },
              { header: 'Order', value: (invoice) => invoice.order_number },
              { header: 'Total', value: (invoice) => invoice.total_amount },
              { header: 'Paid', value: (invoice) => invoice.amount_paid },
              { header: 'Balance', value: (invoice) => invoice.balance_due },
              { header: 'Status', value: (invoice) => invoice.status },
            ], data.items)
          }
        >
          CSV
        </Button>
      </div>
      <DataTable
        rows={data?.items}
        isLoading={isLoading}
        error={error}
        rowClassName={(invoice) => (invoice.is_overdue ? 'is-alert' : '')}
        emptyTitle="No invoices"
        columns={[
          { key: 'invoice_number', header: 'Invoice', render: (invoice) => <><div className="mono strong">{invoice.invoice_number}</div><div className="cell-sub">{formatDate(invoice.invoice_date)}</div></> },
          { key: 'buyer', header: readOnly ? 'Order' : 'Buyer / order', render: (invoice) => <>{!readOnly && <div>{invoice.buyer_name}</div>}<div className="cell-sub">{invoice.order_number}</div></> },
          { key: 'total_amount', header: 'Amount', align: 'right', render: (invoice) => formatCurrency(invoice.total_amount) },
          { key: 'balance_due', header: 'Balance', align: 'right', render: (invoice) => <strong className={invoice.balance_due > 0 ? '' : 'muted'}>{formatCurrency(invoice.balance_due)}</strong> },
          { key: 'due_date', header: 'Due', render: (invoice) => <span className={invoice.is_overdue ? 'text-danger strong' : ''}>{formatDate(invoice.due_date)}</span> },
          { key: 'status', header: 'Status', render: (invoice) => <StatusBadge status={invoice.status} /> },
          ...(canRecord ? [{ key: 'action', header: '', render: (invoice) => invoice.balance_due > 0 && <Button size="sm" variant="secondary" onClick={() => setPayingInvoice(invoice)}>Record payment</Button> }] : []),
        ]}
      />
      {data && <Pagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPageChange={list.setPage} />}
      <RecordPaymentModal kind="buyer" bill={payingInvoice} onClose={() => setPayingInvoice(null)} />
    </>
  );
}

function SupplierBillsTable() {
  const list = useListState();
  const [unpaidOnly, setUnpaidOnly] = useState(true);
  const [payingBill, setPayingBill] = useState(null);
  const { data, isLoading, isFetching, error } = useApiQuery('/finance/supplier-bills', { ...list.queryParams, unpaidOnly });
  return (
    <>
      <div className="toolbar">
        <SearchInput value={list.searchText} onChange={list.setSearchText} placeholder="Search GRN, bill no. or supplier" isSearching={list.isDebouncing || isFetching} />
        <div className="segmented">
          <button className={unpaidOnly ? 'is-active' : ''} onClick={() => setUnpaidOnly(true)}>Unpaid</button>
          <button className={!unpaidOnly ? 'is-active' : ''} onClick={() => setUnpaidOnly(false)}>All</button>
        </div>
      </div>
      <DataTable
        rows={data?.items}
        isLoading={isLoading}
        error={error}
        emptyTitle={unpaidOnly ? 'All supplier bills are paid' : 'No bills'}
        columns={[
          { key: 'receipt_number', header: 'GRN', render: (bill) => <><div className="mono strong">{bill.receipt_number}</div><div className="cell-sub">{formatDate(bill.received_at)}</div></> },
          { key: 'supplier_name', header: 'Supplier' },
          { key: 'bill_number', header: 'Bill no.', render: (bill) => bill.bill_number ?? '—' },
          { key: 'total_amount', header: 'Bill amount', align: 'right', render: (bill) => formatCurrency(bill.total_amount) },
          { key: 'balance_due', header: 'Balance', align: 'right', render: (bill) => <strong>{formatCurrency(bill.balance_due)}</strong> },
          { key: 'status', header: 'Status', render: (bill) => <StatusBadge status={bill.balance_due <= 0 ? 'PAID' : bill.amount_paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID'} /> },
          { key: 'action', header: '', render: (bill) => bill.balance_due > 0 && <Button size="sm" variant="secondary" onClick={() => setPayingBill(bill)}>Pay</Button> },
        ]}
      />
      {data && <Pagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPageChange={list.setPage} />}
      <RecordPaymentModal kind="supplier" bill={payingBill} onClose={() => setPayingBill(null)} />
    </>
  );
}
