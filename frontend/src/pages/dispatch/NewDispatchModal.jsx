import { CheckSquare, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { FormField, fieldErrorsFrom } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { SkeletonRows } from '../../components/ui/Spinner';
import { useApiMutation, useApiQuery } from '../../hooks/useApi';
import { formatCurrency, formatNumber } from '../../utils/format';

const GST_PERCENT = 5;

/** Load the truck: pick passed rolls; the invoice is created from exactly these rolls. */
export function NewDispatchModal({ order, onClose }) {
  const navigate = useNavigate();
  const [selectedRollIds, setSelectedRollIds] = useState(new Set());
  const [vehicle, setVehicle] = useState({ vehicleNumber: '', driverName: '', driverPhone: '' });
  const { data: rolls, isLoading } = useApiQuery('/quality/rolls', { orderId: order?.order_id, status: 'PASSED', pageSize: 100 }, { enabled: Boolean(order) });

  useEffect(() => {
    setSelectedRollIds(new Set());
    setVehicle({ vehicleNumber: '', driverName: '', driverPhone: '' });
  }, [order]);

  const dispatch = useApiMutation({
    path: '/dispatches',
    invalidate: ['/dispatches', '/quality', '/orders', '/dashboard', '/finance'],
    successMessage: (created) => `${created.dispatch_number} loaded · invoice ${created.invoice.invoice_number} raised`,
    onSuccess: (created) => {
      onClose();
      navigate(`/dispatch/${created.id}`);
    },
  });
  const fieldErrors = fieldErrorsFrom(dispatch.error);
  const availableRolls = rolls?.items ?? [];
  const selectedRolls = availableRolls.filter((roll) => selectedRollIds.has(roll.id));
  const selectedMeters = selectedRolls.reduce((sum, roll) => sum + roll.length_meters, 0);
  const invoiceTotal = selectedMeters * (order?.rate_per_meter ?? 0) * (1 + GST_PERCENT / 100);
  const toggleRoll = (rollId) =>
    setSelectedRollIds((current) => {
      const next = new Set(current);
      next.has(rollId) ? next.delete(rollId) : next.add(rollId);
      return next;
    });
  const allSelected = availableRolls.length > 0 && selectedRollIds.size === availableRolls.length;

  return (
    <Modal
      isOpen={Boolean(order)}
      onClose={onClose}
      title={`Load truck · ${order?.order_number}`}
      subtitle={order ? `${order.buyer_name} · ${order.fabric_name} ${order.colour}` : undefined}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            isLoading={dispatch.isPending}
            disabled={!selectedRollIds.size || vehicle.vehicleNumber.trim().length < 4}
            onClick={() => dispatch.mutate({ body: { orderId: order.order_id, rollIds: [...selectedRollIds], ...vehicle, driverName: vehicle.driverName || null, driverPhone: vehicle.driverPhone || null } })}
          >
            Dispatch {selectedRollIds.size} rolls &amp; raise invoice
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="summary-strip">
          <div><span className="muted">Rolls selected</span><strong>{selectedRollIds.size} / {availableRolls.length}</strong></div>
          <div><span className="muted">Meters</span><strong>{formatNumber(selectedMeters)}</strong></div>
          <div><span className="muted">Invoice (incl. {GST_PERCENT}% GST)</span><strong>{formatCurrency(invoiceTotal)}</strong></div>
        </div>
        <div>
          <div className="row row--between" style={{ marginBottom: 8 }}>
            <strong>Passed rolls on the shelf</strong>
            <Button size="sm" variant="ghost" icon={allSelected ? CheckSquare : Square} onClick={() => setSelectedRollIds(allSelected ? new Set() : new Set(availableRolls.map((roll) => roll.id)))}>
              {allSelected ? 'Clear all' : 'Select all'}
            </Button>
          </div>
          {isLoading ? (
            <SkeletonRows rows={3} />
          ) : (
            <div className="roll-grid">
              {availableRolls.map((roll) => (
                <button key={roll.id} type="button" className={`roll-option ${selectedRollIds.has(roll.id) ? 'is-selected' : ''}`} onClick={() => toggleRoll(roll.id)}>
                  <strong className="mono">{roll.roll_number}</strong>
                  {formatNumber(roll.length_meters, 'm')} · grade {roll.grade ?? '—'}
                  <div className="muted">{roll.rack_location ?? 'no rack'}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="form-grid form-grid--3">
          <FormField label="Truck number" error={fieldErrors.vehicleNumber}>
            <input className="input" required value={vehicle.vehicleNumber} onChange={(event) => setVehicle((current) => ({ ...current, vehicleNumber: event.target.value }))} placeholder="MH 04 GH 1234" maxLength={20} />
          </FormField>
          <FormField label="Driver name">
            <input className="input" value={vehicle.driverName} onChange={(event) => setVehicle((current) => ({ ...current, driverName: event.target.value }))} maxLength={80} />
          </FormField>
          <FormField label="Driver phone">
            <input className="input" value={vehicle.driverPhone} onChange={(event) => setVehicle((current) => ({ ...current, driverPhone: event.target.value }))} maxLength={20} />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}
