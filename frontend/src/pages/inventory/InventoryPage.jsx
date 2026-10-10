import { AlertTriangle, Boxes, Calculator, PackagePlus, Plus, Scale, Send, Truck } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable, Pagination } from '../../components/ui/DataTable';
import { FormField } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { SearchInput } from '../../components/ui/SearchInput';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Tabs } from '../../components/ui/Tabs';
import { useListState } from '../../components/ui/useListState';
import { useApiMutation, useApiQuery } from '../../hooks/useApi';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useFabricTypes } from '../../hooks/useLookups';
import { formatCurrency, formatDateTime, formatNumber, formatRupeesShort } from '../../utils/format';
import { IssueYarnModal } from './IssueYarnModal';
import { NewFabricTypeModal } from './NewFabricTypeModal';
import { NewYarnTypeModal } from './NewYarnTypeModal';
import { ReceiveYarnModal } from './ReceiveYarnModal';
import { YarnLedgerModal } from './YarnLedgerModal';

export default function InventoryPage() {
  const { hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState('stock');
  const [openModal, setOpenModal] = useState(null);
  const [ledgerYarn, setLedgerYarn] = useState(null);
  const [adjustingYarn, setAdjustingYarn] = useState(null);
  const { data: allYarns } = useApiQuery('/inventory/yarn-types', { pageSize: 100 });
  const lowStockCount = allYarns?.items.filter((yarn) => yarn.is_low_stock).length ?? 0;
  const stockValue = allYarns?.items.reduce((sum, yarn) => sum + yarn.stock_value, 0) ?? 0;
  const totalKg = allYarns?.items.reduce((sum, yarn) => sum + yarn.current_stock_kg, 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Yarn store"
        description="Raw material in, raw material out. Live balance, reorder alerts and a full ledger."
        actions={
          <>
            {hasRole('STORE_MANAGER', 'PRODUCTION_MANAGER') && <Button variant="secondary" icon={Send} onClick={() => setOpenModal('issue')}>Issue to order</Button>}
            {hasRole('STORE_MANAGER') && <Button icon={Truck} onClick={() => setOpenModal('receive')}>Yarn arrived</Button>}
          </>
        }
      />
      <div className="stack">
        <div className="grid grid--stats">
          <StatCard label="Yarn in store" value={formatNumber(totalKg, 'kg')} hint={`${allYarns?.items.length ?? 0} yarn types`} icon={Boxes} />
          <StatCard label="Stock value" value={formatRupeesShort(stockValue)} hint="at weighted average cost" icon={Scale} tone="teal" />
          <StatCard label="Below reorder level" value={lowStockCount} hint={lowStockCount ? 'order more now' : 'all good'} icon={AlertTriangle} tone={lowStockCount ? 'warning' : 'success'} onClick={() => setActiveTab('stock')} />
        </div>
        <Card padded={false}>
          <div className="card__body">
            <Tabs
              activeTab={activeTab}
              onChange={setActiveTab}
              tabs={[
                { id: 'stock', label: 'Stock', icon: Boxes },
                { id: 'receipts', label: 'Gate entries', icon: Truck },
                { id: 'planner', label: 'Can we start?', icon: Calculator },
                { id: 'recipes', label: 'Fabric recipes', icon: PackagePlus },
              ]}
            />
            {activeTab === 'stock' && (
              <YarnStockTab
                onOpenLedger={setLedgerYarn}
                onAdjust={hasRole('STORE_MANAGER') ? setAdjustingYarn : null}
                onAddYarn={hasRole('STORE_MANAGER', 'PRODUCTION_MANAGER') ? () => setOpenModal('new-yarn') : null}
              />
            )}
            {activeTab === 'receipts' && <ReceiptsTab />}
            {activeTab === 'planner' && <AvailabilityPlanner />}
            {activeTab === 'recipes' && <FabricRecipesTab onAddRecipe={hasRole('PRODUCTION_MANAGER') ? () => setOpenModal('new-fabric') : null} />}
          </div>
        </Card>
      </div>
      <ReceiveYarnModal isOpen={openModal === 'receive'} onClose={() => setOpenModal(null)} />
      <IssueYarnModal isOpen={openModal === 'issue'} onClose={() => setOpenModal(null)} />
      <NewYarnTypeModal isOpen={openModal === 'new-yarn'} onClose={() => setOpenModal(null)} />
      <NewFabricTypeModal isOpen={openModal === 'new-fabric'} onClose={() => setOpenModal(null)} />
      <YarnLedgerModal yarn={ledgerYarn} onClose={() => setLedgerYarn(null)} />
      <AdjustStockModal yarn={adjustingYarn} onClose={() => setAdjustingYarn(null)} />
    </>
  );
}

function YarnStockTab({ onOpenLedger, onAdjust, onAddYarn }) {
  const list = useListState({ pageSize: 20 });
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const { data, isLoading, isFetching, error } = useApiQuery('/inventory/yarn-types', { ...list.queryParams, lowStockOnly });
  return (
    <>
      <div className="toolbar">
        <SearchInput value={list.searchText} onChange={list.setSearchText} placeholder="Search code, name or colour" isSearching={list.isDebouncing || isFetching} />
        <div className="segmented">
          <button className={!lowStockOnly ? 'is-active' : ''} onClick={() => setLowStockOnly(false)}>All</button>
          <button className={lowStockOnly ? 'is-active' : ''} onClick={() => setLowStockOnly(true)}>Low stock</button>
        </div>
        {onAddYarn && <Button variant="secondary" size="sm" icon={Plus} onClick={onAddYarn}>New yarn type</Button>}
      </div>
      <DataTable
        rows={data?.items}
        isLoading={isLoading}
        error={error}
        rowClassName={(yarn) => (yarn.is_low_stock ? 'is-alert' : '')}
        onRowClick={onOpenLedger}
        emptyTitle={lowStockOnly ? 'No yarn is running low' : 'No yarn found'}
        emptyDescription={!lowStockOnly && !list.searchText ? 'Add the yarns you buy with "New yarn type", then record deliveries with "Yarn arrived".' : undefined}
        columns={[
          { key: 'name', header: 'Yarn', render: (yarn) => <><div className="cell-title">{yarn.name}</div><div className="cell-sub"><span className="mono">{yarn.code}</span> · {yarn.material} · {yarn.yarn_count}</div></> },
          { key: 'colour', header: 'Colour' },
          {
            key: 'stock',
            header: 'Stock vs reorder level',
            width: 260,
            render: (yarn) => (
              <>
                <div className="row row--between" style={{ fontSize: 12, marginBottom: 4 }}>
                  <strong className={yarn.is_low_stock ? 'text-warning' : ''}>{formatNumber(yarn.current_stock_kg, 'kg')}</strong>
                  <span className="muted">reorder at {formatNumber(yarn.reorder_level_kg)}</span>
                </div>
                <ProgressBar value={yarn.current_stock_kg} max={Math.max(yarn.reorder_level_kg * 3, yarn.current_stock_kg)} tone={yarn.is_low_stock ? 'warning' : 'success'} />
              </>
            ),
          },
          { key: 'average_cost_per_kg', header: 'Avg cost', align: 'right', render: (yarn) => `${formatCurrency(yarn.average_cost_per_kg)}/kg` },
          { key: 'stock_value', header: 'Value', align: 'right', render: (yarn) => formatCurrency(yarn.stock_value) },
          { key: 'state', header: '', render: (yarn) => (yarn.is_low_stock ? <StatusBadge status="IDLE" label="Reorder" /> : <StatusBadge status="PASSED" label="OK" />) },
          ...(onAdjust ? [{ key: 'actions', header: '', render: (yarn) => <Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); onAdjust(yarn); }}>Adjust</Button> }] : []),
        ]}
      />
      {data && <Pagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPageChange={list.setPage} />}
    </>
  );
}

function ReceiptsTab() {
  const list = useListState();
  const { data, isLoading, isFetching, error } = useApiQuery('/inventory/receipts', list.queryParams);
  return (
    <>
      <div className="toolbar">
        <SearchInput value={list.searchText} onChange={list.setSearchText} placeholder="Search GRN, supplier or challan" isSearching={list.isDebouncing || isFetching} />
      </div>
      <DataTable
        rows={data?.items}
        isLoading={isLoading}
        error={error}
        columns={[
          { key: 'receipt_number', header: 'GRN', render: (receipt) => <><div className="mono strong">{receipt.receipt_number}</div><div className="cell-sub">{formatDateTime(receipt.received_at)}</div></> },
          { key: 'supplier_name', header: 'Supplier' },
          { key: 'yarn_summary', header: 'Yarn', render: (receipt) => <span className="soft">{receipt.yarn_summary}</span> },
          { key: 'total_kg', header: 'Kg', align: 'right', render: (receipt) => formatNumber(receipt.total_kg) },
          { key: 'vehicle_number', header: 'Truck', render: (receipt) => receipt.vehicle_number ?? '—' },
          { key: 'order_number', header: 'For order', render: (receipt) => receipt.order_number ?? <span className="muted">Stock</span> },
          { key: 'total_amount', header: 'Bill', align: 'right', render: (receipt) => formatCurrency(receipt.total_amount) },
          { key: 'balance_due', header: 'Payment', render: (receipt) => <StatusBadge status={receipt.balance_due <= 0 ? 'PAID' : receipt.amount_paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID'} /> },
        ]}
      />
      {data && <Pagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPageChange={list.setPage} />}
    </>
  );
}

function AvailabilityPlanner() {
  const { data: fabricTypes } = useFabricTypes();
  const [fabricTypeId, setFabricTypeId] = useState('');
  const [quantityMeters, setQuantityMeters] = useState('5000');
  const debouncedMeters = useDebouncedValue(quantityMeters, 400);
  const { data: result, isFetching } = useApiQuery(
    '/inventory/availability',
    { fabricTypeId, quantityMeters: debouncedMeters },
    { enabled: Boolean(fabricTypeId && Number(debouncedMeters) > 0) },
  );
  return (
    <div className="grid grid--2">
      <div className="stack" style={{ gap: 14 }}>
        <p className="soft">A buyer is on the phone asking for a new order. Check in seconds whether the store can support it.</p>
        <FormField label="Fabric">
          <select className="select" value={fabricTypeId} onChange={(event) => setFabricTypeId(event.target.value)}>
            <option value="">Choose fabric…</option>
            {fabricTypes?.map((fabric) => <option key={fabric.id} value={fabric.id}>{fabric.name} ({fabric.yarn_kg_per_meter} kg yarn / m)</option>)}
          </select>
        </FormField>
        <FormField label="Meters required">
          <input className="input" type="number" min="1" value={quantityMeters} onChange={(event) => setQuantityMeters(event.target.value)} />
        </FormField>
      </div>
      <div>
        {!result && <div className="callout callout--info">Pick a fabric to see the yarn requirement.{isFetching && ' Checking…'}</div>}
        {result && (
          <Card className={result.canStart ? '' : ''}>
            <div className={`callout ${result.canStart ? 'callout--success' : 'callout--warning'}`} style={{ marginBottom: 14 }}>
              <strong>{result.canStart ? 'Yes, we can start right away.' : `Order ${formatNumber(result.shortfallKg, 'kg')} more yarn first.`}</strong>
            </div>
            <dl className="key-values">
              <div><dt>Yarn</dt><dd>{result.yarnName}</dd></div>
              <div><dt>Required</dt><dd>{formatNumber(result.requiredKg, 'kg')}</dd></div>
              <div><dt>In store</dt><dd>{formatNumber(result.availableKg, 'kg')}</dd></div>
              <div><dt>Est. yarn cost</dt><dd>{formatCurrency(result.estimatedMaterialCost)}</dd></div>
            </dl>
          </Card>
        )}
      </div>
    </div>
  );
}

function FabricRecipesTab({ onAddRecipe }) {
  const { data, isLoading, error } = useFabricTypes();
  return (
    <>
      {onAddRecipe && (
        <div className="toolbar">
          <span className="muted" style={{ fontSize: 12 }}>Orders are taken against these recipes.</span>
          <Button variant="secondary" size="sm" icon={Plus} onClick={onAddRecipe}>New recipe</Button>
        </div>
      )}
      <DataTable
        rows={data}
        isLoading={isLoading}
        error={error}
        emptyTitle="No fabric recipes yet"
        emptyDescription="A recipe says which yarn a fabric uses and how much per meter. Orders need one."
        columns={[
          { key: 'name', header: 'Fabric', render: (fabric) => <strong>{fabric.name}</strong> },
          { key: 'construction', header: 'Construction' },
          { key: 'gsm', header: 'GSM', align: 'right' },
          { key: 'width_inches', header: 'Width', align: 'right', render: (fabric) => (fabric.width_inches ? `${fabric.width_inches}"` : '—') },
          { key: 'yarn', header: 'Yarn', render: (fabric) => <><span className="mono">{fabric.yarn_code}</span> · {fabric.yarn_name}</> },
          { key: 'yarn_kg_per_meter', header: 'Yarn per meter', align: 'right', render: (fabric) => `${fabric.yarn_kg_per_meter} kg` },
        ]}
      />
    </>
  );
}

function AdjustStockModal({ yarn, onClose }) {
  const [quantityKg, setQuantityKg] = useState('');
  const [note, setNote] = useState('');
  const adjust = useApiMutation({
    path: '/inventory/adjustments',
    invalidate: ['/inventory', '/dashboard'],
    successMessage: 'Stock adjusted',
    onSuccess: () => {
      setQuantityKg('');
      setNote('');
      onClose();
    },
  });
  return (
    <Modal
      isOpen={Boolean(yarn)}
      onClose={onClose}
      title={`Adjust ${yarn?.name}`}
      subtitle="Use after a physical stock count. Positive adds, negative removes."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button isLoading={adjust.isPending} disabled={!Number(quantityKg) || note.trim().length < 3} onClick={() => adjust.mutate({ body: { yarnTypeId: yarn.id, quantityKg: Number(quantityKg), note } })}>
            Save adjustment
          </Button>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <FormField label="Change (kg)" hint={yarn ? `Currently ${formatNumber(yarn.current_stock_kg, 'kg')}` : undefined}>
          <input className="input" type="number" step="0.01" value={quantityKg} onChange={(event) => setQuantityKg(event.target.value)} placeholder="-25 or 40" />
        </FormField>
        <FormField label="Reason">
          <input className="input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Physical count on 10 Oct" maxLength={200} />
        </FormField>
      </div>
    </Modal>
  );
}
