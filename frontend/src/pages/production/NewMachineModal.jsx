import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { FormField, fieldErrorsFrom } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { STAGE_LABELS } from '../../config/statuses';
import { useApiMutation } from '../../hooks/useApi';

const emptyMachine = { code: '', name: '', stage: 'WEAVING', hourlyRunningCost: '', location: '' };

/** Puts a machine on the floor board. It starts idle, ready for a job. */
export function NewMachineModal({ isOpen, onClose }) {
  const [machine, setMachine] = useState(emptyMachine);
  useEffect(() => {
    if (isOpen) setMachine(emptyMachine);
  }, [isOpen]);

  const create = useApiMutation({
    path: '/production/machines',
    invalidate: ['/production', '/dashboard'],
    successMessage: (created) => `${created.code} added to the floor.`,
    onSuccess: onClose,
  });
  const fieldErrors = fieldErrorsFrom(create.error);
  const update = (field) => (event) => setMachine((current) => ({ ...current, [field]: event.target.value }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New machine"
      subtitle="It joins the board as idle, ready for a job."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="new-machine-form" isLoading={create.isPending}>Add machine</Button>
        </>
      }
    >
      <form
        id="new-machine-form"
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate({ body: { ...machine, hourlyRunningCost: Number(machine.hourlyRunningCost), location: machine.location || null } });
        }}
      >
        <FormField label="Code" error={fieldErrors.code} hint="Short and unique, e.g. LOOM-01">
          <input className="input mono" required minLength={2} maxLength={20} value={machine.code} onChange={update('code')} />
        </FormField>
        <FormField label="Name" error={fieldErrors.name}>
          <input className="input" required minLength={2} maxLength={120} value={machine.name} onChange={update('name')} placeholder="Rapier loom 1" />
        </FormField>
        <FormField label="Stage" error={fieldErrors.stage}>
          <select className="select" value={machine.stage} onChange={update('stage')}>
            {Object.entries(STAGE_LABELS).map(([stage, label]) => <option key={stage} value={stage}>{label}</option>)}
          </select>
        </FormField>
        <FormField label="Running cost (₹/hour)" error={fieldErrors.hourlyRunningCost} hint="Power and upkeep, used in order costing">
          <input className="input" type="number" min="0" step="0.01" required value={machine.hourlyRunningCost} onChange={update('hourlyRunningCost')} />
        </FormField>
        <FormField label="Location (optional)" error={fieldErrors.location}>
          <input className="input" maxLength={60} value={machine.location} onChange={update('location')} placeholder="Shed A" />
        </FormField>
      </form>
    </Modal>
  );
}
