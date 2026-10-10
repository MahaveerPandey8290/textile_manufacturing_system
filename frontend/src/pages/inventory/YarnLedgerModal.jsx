import { useState } from 'react';
import { DataTable, Pagination } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { useApiQuery } from '../../hooks/useApi';
import { formatCurrency, formatDateTime, formatNumber, humanize } from '../../utils/format';

/** Every kilogram in and out for one yarn — the notebook, but searchable and never lost. */
export function YarnLedgerModal({ yarn, onClose }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useApiQuery(`/inventory/yarn-types/${yarn?.id}/movements`, { page, pageSize: 12 }, { enabled: Boolean(yarn) });
  return (
    <Modal isOpen={Boolean(yarn)} onClose={onClose} title={`${yarn?.code} · ${yarn?.name}`} subtitle={`Stock ledger · ${formatNumber(yarn?.current_stock_kg, 'kg')} on hand`} size="lg">
      <DataTable
        rows={data?.items}
        isLoading={isLoading}
        error={error}
        columns={[
          { key: 'created_at', header: 'When', render: (movement) => formatDateTime(movement.created_at) },
          { key: 'movement_type', header: 'Type', render: (movement) => humanize(movement.movement_type) },
          { key: 'reference', header: 'Reference', render: (movement) => movement.receipt_number ?? movement.order_number ?? movement.note ?? '—' },
          { key: 'quantity_kg', header: 'Kg', align: 'right', render: (movement) => <strong className={movement.quantity_kg < 0 ? 'text-danger' : 'text-success'}>{movement.quantity_kg > 0 ? '+' : ''}{formatNumber(movement.quantity_kg)}</strong> },
          { key: 'cost_per_kg', header: 'Rate', align: 'right', render: (movement) => formatCurrency(movement.cost_per_kg) },
          { key: 'created_by_name', header: 'By' },
        ]}
      />
      {data && <Pagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPageChange={setPage} />}
    </Modal>
  );
}
