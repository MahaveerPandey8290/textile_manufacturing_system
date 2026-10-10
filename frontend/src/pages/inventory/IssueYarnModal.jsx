import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { useApiMutation, useApiQuery } from '../../hooks/useApi';
import { useYarnTypes } from '../../hooks/useLookups';
import { formatNumber } from '../../utils/format';

/** Store hands yarn to the floor for an order; this is what makes per-order material cost real. */
export function IssueYarnModal({ isOpen, onClose, order, suggestedYarnTypeId, suggestedKg }) {
  const [form, setForm] = useState({ orderId: '', yarnTypeId: '', quantityKg: '', note: '' });
  const { data: yarnTypes } = useYarnTypes();
  const { data: openOrders } = useApiQuery('/orders', { pageSize: 100 }, { enabled: isOpen && !order });

  useEffect(() => {
    if (isOpen) setForm({ orderId: order?.id ?? '', yarnTypeId: suggestedYarnTypeId ?? '', quantityKg: suggestedKg || '', note: '' });
  }, [isOpen, order, suggestedYarnTypeId, suggestedKg]);

  const issueYarn = useApiMutation({
    path: '/inventory/issues',
    invalidate: ['/inventory', '/orders', '/dashboard', '/reports'],
    successMessage: 'Yarn issued to the floor',
    onSuccess: onClose,
  });
  const selectedYarn = yarnTypes?.items.find((yarn) => String(yarn.id) === String(form.yarnTypeId));
  const updateField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Issue yarn to an order"
      subtitle={order ? `${order.order_number} · ${order.buyer_name}` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="issue-yarn-form" isLoading={issueYarn.isPending}>Issue yarn</Button>
        </>
      }
    >
      <form
        id="issue-yarn-form"
        className="stack"
        style={{ gap: 14 }}
        onSubmit={(event) => {
          event.preventDefault();
          issueYarn.mutate({ body: { orderId: Number(form.orderId), yarnTypeId: Number(form.yarnTypeId), quantityKg: Number(form.quantityKg), note: form.note || null } });
        }}
      >
        {!order && (
          <FormField label="Order">
            <select className="select" required value={form.orderId} onChange={updateField('orderId')}>
              <option value="">Choose order…</option>
              {openOrders?.items
                .filter((candidate) => !['DISPATCHED', 'CANCELLED'].includes(candidate.status))
                .map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.order_number} · {candidate.buyer_name}</option>)}
            </select>
          </FormField>
        )}
        <FormField label="Yarn" hint={selectedYarn ? `${formatNumber(selectedYarn.current_stock_kg, 'kg')} in stock` : undefined}>
          <select className="select" required value={form.yarnTypeId} onChange={updateField('yarnTypeId')}>
            <option value="">Choose yarn…</option>
            {yarnTypes?.items.map((yarn) => <option key={yarn.id} value={yarn.id}>{yarn.code} · {yarn.name}</option>)}
          </select>
        </FormField>
        <FormField label="Quantity (kg)" error={selectedYarn && Number(form.quantityKg) > selectedYarn.current_stock_kg ? 'More than what is in stock' : undefined}>
          <input className="input" type="number" min="0.01" step="0.01" required value={form.quantityKg} onChange={updateField('quantityKg')} />
        </FormField>
        <FormField label="Note">
          <input className="input" value={form.note} onChange={updateField('note')} placeholder="Optional" maxLength={200} />
        </FormField>
      </form>
    </Modal>
  );
}
