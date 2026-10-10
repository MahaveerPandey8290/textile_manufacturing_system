import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { FormField, fieldErrorsFrom } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { STAGE_LABELS } from '../../config/statuses';
import { useApiMutation, useApiQuery } from '../../hooks/useApi';
import { useMachines } from '../../hooks/useLookups';

/** Put an order on a machine for one stage. Pass `order` to lock the order, or pick one from open orders. */
export function PlanJobModal({ isOpen, onClose, order }) {
  const [form, setForm] = useState({ orderId: '', stage: 'WEAVING', machineId: '', plannedQuantity: '' });
  const { data: machineBoard } = useMachines();
  const { data: openOrders } = useApiQuery('/orders', { pageSize: 100 }, { enabled: isOpen && !order });

  useEffect(() => {
    if (isOpen) setForm({ orderId: order?.id ?? '', stage: 'WEAVING', machineId: '', plannedQuantity: order?.quantity_meters ?? '' });
  }, [isOpen, order]);

  const planJob = useApiMutation({
    path: '/production/jobs',
    invalidate: ['/production', '/orders', '/dashboard'],
    successMessage: (job) => `${job.job_number} planned`,
    onSuccess: onClose,
  });
  const fieldErrors = fieldErrorsFrom(planJob.error);
  const machinesForStage = machineBoard?.machines.filter((machine) => machine.stage === form.stage) ?? [];
  const updateField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value, ...(field === 'stage' ? { machineId: '' } : {}) }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Plan a production job"
      subtitle={order ? `${order.order_number} · ${order.buyer_name}` : 'Assign an order to a machine'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="plan-job-form" isLoading={planJob.isPending}>Plan job</Button>
        </>
      }
    >
      <form
        id="plan-job-form"
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          planJob.mutate({ body: { orderId: Number(form.orderId), stage: form.stage, machineId: Number(form.machineId), plannedQuantity: Number(form.plannedQuantity) } });
        }}
      >
        {!order && (
          <FormField label="Order" className="span-all" error={fieldErrors.orderId}>
            <select className="select" required value={form.orderId} onChange={updateField('orderId')}>
              <option value="">Choose order…</option>
              {openOrders?.items
                .filter((candidate) => !['DISPATCHED', 'CANCELLED'].includes(candidate.status))
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.order_number} · {candidate.buyer_name} · {candidate.fabric_name} ({candidate.quantity_meters} m)
                  </option>
                ))}
            </select>
          </FormField>
        )}
        <FormField label="Stage">
          <select className="select" value={form.stage} onChange={updateField('stage')}>
            {Object.entries(STAGE_LABELS).map(([stage, label]) => <option key={stage} value={stage}>{label}</option>)}
          </select>
        </FormField>
        <FormField label="Machine" error={fieldErrors.machineId}>
          <select className="select" required value={form.machineId} onChange={updateField('machineId')}>
            <option value="">Choose machine…</option>
            {machinesForStage.map((machine) => (
              <option key={machine.id} value={machine.id} disabled={['BREAKDOWN', 'MAINTENANCE'].includes(machine.status)}>
                {machine.code} · {machine.name} ({machine.status.toLowerCase()})
              </option>
            ))}
          </select>
        </FormField>
        <FormField label={`Planned quantity (${form.stage === 'SPINNING' ? 'kg' : 'm'})`} className="span-all" error={fieldErrors.plannedQuantity}>
          <input className="input" type="number" min="1" step="0.01" required value={form.plannedQuantity} onChange={updateField('plannedQuantity')} />
        </FormField>
      </form>
    </Modal>
  );
}
