import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { FormField, fieldErrorsFrom } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { useApiMutation, useApiQuery } from '../../hooks/useApi';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useBuyers, useFabricTypes } from '../../hooks/useLookups';
import { formatCurrency, formatNumber, todayIso } from '../../utils/format';

const EMPTY_ORDER = { buyerId: '', fabricTypeId: '', colour: '', quantityMeters: '', ratePerMeter: '', dueDate: '', priority: 'NORMAL', notes: '' };

export function NewOrderModal({ isOpen, onClose, onCreated }) {
  const [order, setOrder] = useState(EMPTY_ORDER);
  const { data: buyers } = useBuyers();
  const { data: fabricTypes } = useFabricTypes();
  const updateField = (field) => (event) => setOrder((current) => ({ ...current, [field]: event.target.value }));

  // As soon as fabric + quantity are known, tell the office whether there is enough yarn to start.
  const debouncedQuantity = useDebouncedValue(order.quantityMeters, 400);
  const { data: availability, isFetching: isCheckingYarn } = useApiQuery(
    '/inventory/availability',
    { fabricTypeId: order.fabricTypeId, quantityMeters: debouncedQuantity },
    { enabled: Boolean(order.fabricTypeId && Number(debouncedQuantity) > 0), placeholderData: undefined },
  );

  const createOrder = useApiMutation({
    path: '/orders',
    invalidate: ['/orders', '/dashboard'],
    successMessage: (created) => `Order ${created.order_number} created`,
    onSuccess: (created) => {
      setOrder(EMPTY_ORDER);
      onClose();
      onCreated?.(created);
    },
  });
  const fieldErrors = fieldErrorsFrom(createOrder.error);

  const handleSubmit = (event) => {
    event.preventDefault();
    createOrder.mutate({
      body: {
        buyerId: Number(order.buyerId),
        fabricTypeId: Number(order.fabricTypeId),
        colour: order.colour,
        quantityMeters: Number(order.quantityMeters),
        ratePerMeter: Number(order.ratePerMeter),
        dueDate: order.dueDate,
        priority: order.priority,
        notes: order.notes || null,
      },
    });
  };

  const orderValue = Number(order.quantityMeters) * Number(order.ratePerMeter);
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New buyer order"
      subtitle="Capture the order once; everyone from the floor to accounts sees it."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="new-order-form" isLoading={createOrder.isPending}>Create order</Button>
        </>
      }
    >
      <form id="new-order-form" className="form-grid" onSubmit={handleSubmit}>
        <FormField label="Buyer" error={fieldErrors.buyerId}>
          <select className="select" required value={order.buyerId} onChange={updateField('buyerId')}>
            <option value="">Choose buyer…</option>
            {buyers?.items.map((buyer) => <option key={buyer.id} value={buyer.id}>{buyer.company_name}</option>)}
          </select>
        </FormField>
        <FormField label="Fabric" error={fieldErrors.fabricTypeId}>
          <select className="select" required value={order.fabricTypeId} onChange={updateField('fabricTypeId')}>
            <option value="">Choose fabric…</option>
            {fabricTypes?.map((fabric) => <option key={fabric.id} value={fabric.id}>{fabric.name} · {fabric.gsm} GSM</option>)}
          </select>
        </FormField>
        <FormField label="Colour / shade" error={fieldErrors.colour}>
          <input className="input" required value={order.colour} onChange={updateField('colour')} placeholder="e.g. Navy Blue" />
        </FormField>
        <FormField label="Quantity (meters)" error={fieldErrors.quantityMeters}>
          <input className="input" type="number" min="1" step="0.01" required value={order.quantityMeters} onChange={updateField('quantityMeters')} />
        </FormField>
        <FormField label="Rate per meter (₹)" error={fieldErrors.ratePerMeter} hint={orderValue > 0 ? `Order value ${formatCurrency(orderValue)} + GST` : undefined}>
          <input className="input" type="number" min="0" step="0.01" required value={order.ratePerMeter} onChange={updateField('ratePerMeter')} />
        </FormField>
        <FormField label="Delivery due" error={fieldErrors.dueDate}>
          <input className="input" type="date" min={todayIso()} required value={order.dueDate} onChange={updateField('dueDate')} />
        </FormField>
        <FormField label="Priority">
          <select className="select" value={order.priority} onChange={updateField('priority')}>
            {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((priority) => <option key={priority} value={priority}>{priority.charAt(0) + priority.slice(1).toLowerCase()}</option>)}
          </select>
        </FormField>
        <FormField label="Notes" className="span-all">
          <textarea className="textarea" value={order.notes} onChange={updateField('notes')} placeholder="Packing, selvedge marking, lab dip reference…" maxLength={1000} />
        </FormField>
        {availability && (
          <div className={`callout span-all ${availability.canStart ? 'callout--success' : 'callout--warning'}`}>
            {availability.canStart ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <div>
              <strong>{availability.canStart ? 'Enough yarn to start' : `Short by ${formatNumber(availability.shortfallKg, 'kg')}`}</strong>
              <div>
                Needs {formatNumber(availability.requiredKg, 'kg')} of {availability.yarnName}; {formatNumber(availability.availableKg, 'kg')} in stock.
                Estimated yarn cost {formatCurrency(availability.estimatedMaterialCost)}.
                {isCheckingYarn && ' Checking…'}
              </div>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
