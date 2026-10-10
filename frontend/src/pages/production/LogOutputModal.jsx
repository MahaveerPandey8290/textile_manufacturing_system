import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { FormField, fieldErrorsFrom } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { useApiMutation } from '../../hooks/useApi';
import { useActiveWorkers, useShifts } from '../../hooks/useLookups';

/** Shift output entry for a running job. Labour and machine cost are calculated on the server. */
export function LogOutputModal({ machine, onClose }) {
  const [form, setForm] = useState({ workerId: '', shiftId: '', quantityProduced: '', hoursWorked: '8' });
  const { data: workers } = useActiveWorkers();
  const { data: shifts } = useShifts();
  useEffect(() => {
    if (machine) setForm({ workerId: '', shiftId: '', quantityProduced: '', hoursWorked: '8' });
  }, [machine]);

  const logOutput = useApiMutation({
    path: '/production/logs',
    invalidate: ['/production', '/dashboard', '/orders', '/reports'],
    successMessage: 'Output logged',
    onSuccess: onClose,
  });
  const fieldErrors = fieldErrorsFrom(logOutput.error);
  const operators = workers?.items.filter((worker) => !machine || worker.department === machine.stage) ?? [];
  const unit = machine?.quantity_unit ?? 'm';
  const updateField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <Modal
      isOpen={Boolean(machine)}
      onClose={onClose}
      title={`Log output · ${machine?.code}`}
      subtitle={machine ? `${machine.job_number} · ${machine.order_number} · ${machine.buyer_name}` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="log-output-form" isLoading={logOutput.isPending}>Save</Button>
        </>
      }
    >
      <form
        id="log-output-form"
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          logOutput.mutate({
            body: {
              productionJobId: machine.job_id,
              workerId: form.workerId ? Number(form.workerId) : null,
              shiftId: form.shiftId ? Number(form.shiftId) : null,
              quantityProduced: Number(form.quantityProduced),
              hoursWorked: Number(form.hoursWorked),
            },
          });
        }}
      >
        <FormField label={`Produced (${unit})`} error={fieldErrors.quantityProduced}>
          <input className="input" type="number" min="0.01" step="0.01" required autoFocus value={form.quantityProduced} onChange={updateField('quantityProduced')} />
        </FormField>
        <FormField label="Hours run" error={fieldErrors.hoursWorked}>
          <input className="input" type="number" min="0.25" max="24" step="0.25" required value={form.hoursWorked} onChange={updateField('hoursWorked')} />
        </FormField>
        <FormField label="Operator">
          <select className="select" value={form.workerId} onChange={updateField('workerId')}>
            <option value="">Not recorded</option>
            {operators.map((worker) => <option key={worker.id} value={worker.id}>{worker.full_name} ({worker.employee_code})</option>)}
          </select>
        </FormField>
        <FormField label="Shift">
          <select className="select" value={form.shiftId} onChange={updateField('shiftId')}>
            <option value="">—</option>
            {shifts?.map((shift) => <option key={shift.id} value={shift.id}>{shift.name}</option>)}
          </select>
        </FormField>
      </form>
    </Modal>
  );
}
