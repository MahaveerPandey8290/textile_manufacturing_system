import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { FormField, fieldErrorsFrom } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { useApiMutation, useApiQuery } from '../../hooks/useApi';
import { useSuppliers, useYarnTypes } from '../../hooks/useLookups';
import { formatCurrency, formatNumber } from '../../utils/format';

const emptyLine = () => ({ key: crypto.randomUUID(), yarnTypeId: '', quantityKg: '', costPerKg: '' });

/** Gate entry (GRN): one truck, one or more yarn lines. Stock and the supplier bill update together. */
export function ReceiveYarnModal({ isOpen, onClose }) {
  const [header, setHeader] = useState({ supplierId: '', orderId: '', vehicleNumber: '', challanNumber: '', billNumber: '' });
  const [lines, setLines] = useState([emptyLine()]);
  const { data: suppliers } = useSuppliers();
  const { data: yarnTypes } = useYarnTypes();
  const { data: openOrders } = useApiQuery('/orders', { pageSize: 100 }, { enabled: isOpen });

  useEffect(() => {
    if (isOpen) {
      setHeader({ supplierId: '', orderId: '', vehicleNumber: '', challanNumber: '', billNumber: '' });
      setLines([emptyLine()]);
    }
  }, [isOpen]);

  const receiveYarn = useApiMutation({
    path: '/inventory/receipts',
    invalidate: ['/inventory', '/dashboard', '/finance', '/suppliers'],
    successMessage: (receipt) => `${receipt.receipt_number} saved. Stock updated.`,
    onSuccess: onClose,
  });
  const fieldErrors = fieldErrorsFrom(receiveYarn.error);
  const updateHeader = (field) => (event) => setHeader((current) => ({ ...current, [field]: event.target.value }));
  const updateLine = (key, field, value) => setLines((current) => current.map((line) => (line.key === key ? { ...line, [field]: value } : line)));
  const totalKg = lines.reduce((sum, line) => sum + (Number(line.quantityKg) || 0), 0);
  const totalAmount = lines.reduce((sum, line) => sum + (Number(line.quantityKg) || 0) * (Number(line.costPerKg) || 0), 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Yarn arrived at the gate"
      subtitle="Record what came in before it goes into the store."
      size="lg"
      footer={
        <>
          <span className="muted" style={{ marginRight: 'auto' }}>
            {formatNumber(totalKg, 'kg')} · bill {formatCurrency(totalAmount)}
          </span>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="receive-yarn-form" isLoading={receiveYarn.isPending}>Save gate entry</Button>
        </>
      }
    >
      <form
        id="receive-yarn-form"
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          receiveYarn.mutate({
            body: {
              supplierId: Number(header.supplierId),
              orderId: header.orderId ? Number(header.orderId) : null,
              vehicleNumber: header.vehicleNumber || null,
              challanNumber: header.challanNumber || null,
              billNumber: header.billNumber || null,
              items: lines.map((line) => ({ yarnTypeId: Number(line.yarnTypeId), quantityKg: Number(line.quantityKg), costPerKg: Number(line.costPerKg) })),
            },
          });
        }}
      >
        <div className="form-grid form-grid--3">
          <FormField label="Supplier" error={fieldErrors.supplierId}>
            <select className="select" required value={header.supplierId} onChange={updateHeader('supplierId')}>
              <option value="">Choose supplier…</option>
              {suppliers?.items.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.company_name}</option>)}
            </select>
          </FormField>
          <FormField label="For order (optional)" hint="Links this yarn to a specific order">
            <select className="select" value={header.orderId} onChange={updateHeader('orderId')}>
              <option value="">General stock</option>
              {openOrders?.items.filter((order) => !['DISPATCHED', 'CANCELLED'].includes(order.status)).map((order) => <option key={order.id} value={order.id}>{order.order_number} · {order.buyer_name}</option>)}
            </select>
          </FormField>
          <FormField label="Truck number">
            <input className="input" value={header.vehicleNumber} onChange={updateHeader('vehicleNumber')} placeholder="MH 04 AB 1234" maxLength={20} />
          </FormField>
          <FormField label="Challan no.">
            <input className="input" value={header.challanNumber} onChange={updateHeader('challanNumber')} maxLength={40} />
          </FormField>
          <FormField label="Supplier bill no.">
            <input className="input" value={header.billNumber} onChange={updateHeader('billNumber')} maxLength={40} />
          </FormField>
        </div>
        <div>
          <div className="row row--between" style={{ marginBottom: 8 }}>
            <strong>Yarn lines</strong>
            <Button type="button" variant="ghost" size="sm" icon={Plus} onClick={() => setLines((current) => [...current, emptyLine()])}>Add line</Button>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {lines.map((line, index) => (
              <div key={line.key} className="form-grid" style={{ gridTemplateColumns: '2fr 1fr 1fr auto', alignItems: 'end' }}>
                <FormField label={index === 0 ? 'Yarn type' : ''} error={fieldErrors[`items.${index}.yarnTypeId`]}>
                  <select className="select" required value={line.yarnTypeId} onChange={(event) => updateLine(line.key, 'yarnTypeId', event.target.value)}>
                    <option value="">Choose yarn…</option>
                    {yarnTypes?.items.map((yarn) => <option key={yarn.id} value={yarn.id}>{yarn.code} · {yarn.name} · {yarn.colour}</option>)}
                  </select>
                </FormField>
                <FormField label={index === 0 ? 'Quantity (kg)' : ''}>
                  <input className="input" type="number" min="0.01" step="0.01" required value={line.quantityKg} onChange={(event) => updateLine(line.key, 'quantityKg', event.target.value)} />
                </FormField>
                <FormField label={index === 0 ? 'Rate (₹/kg)' : ''}>
                  <input className="input" type="number" min="0" step="0.01" required value={line.costPerKg} onChange={(event) => updateLine(line.key, 'costPerKg', event.target.value)} />
                </FormField>
                <button type="button" className="icon-button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((candidate) => candidate.key !== line.key))} aria-label="Remove line">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
