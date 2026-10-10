import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { FormField, fieldErrorsFrom } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { useApiMutation } from '../../hooks/useApi';

const emptyYarn = { code: '', name: '', material: '', yarnCount: '', colour: '', reorderLevelKg: '' };

/** Adds a yarn to the store's catalogue. Stock starts at zero and grows with gate entries. */
export function NewYarnTypeModal({ isOpen, onClose }) {
  const [yarn, setYarn] = useState(emptyYarn);
  useEffect(() => {
    if (isOpen) setYarn(emptyYarn);
  }, [isOpen]);

  const create = useApiMutation({
    path: '/inventory/yarn-types',
    invalidate: ['/inventory'],
    successMessage: (created) => `${created.code} added to the store.`,
    onSuccess: onClose,
  });
  const fieldErrors = fieldErrorsFrom(create.error);
  const update = (field) => (event) => setYarn((current) => ({ ...current, [field]: event.target.value }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New yarn type"
      subtitle="Stock starts at 0 kg. It goes up when yarn arrives at the gate."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="new-yarn-form" isLoading={create.isPending}>Add yarn</Button>
        </>
      }
    >
      <form
        id="new-yarn-form"
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate({ body: { ...yarn, reorderLevelKg: Number(yarn.reorderLevelKg) } });
        }}
      >
        <FormField label="Code" error={fieldErrors.code} hint="Short and unique, e.g. CT-30">
          <input className="input mono" required minLength={2} maxLength={30} value={yarn.code} onChange={update('code')} />
        </FormField>
        <FormField label="Name" error={fieldErrors.name}>
          <input className="input" required minLength={2} maxLength={120} value={yarn.name} onChange={update('name')} placeholder="Cotton 30s combed" />
        </FormField>
        <FormField label="Material" error={fieldErrors.material}>
          <input className="input" required minLength={2} maxLength={60} value={yarn.material} onChange={update('material')} placeholder="Cotton" />
        </FormField>
        <FormField label="Count" error={fieldErrors.yarnCount}>
          <input className="input" required maxLength={20} value={yarn.yarnCount} onChange={update('yarnCount')} placeholder="30s" />
        </FormField>
        <FormField label="Colour" error={fieldErrors.colour}>
          <input className="input" required minLength={2} maxLength={60} value={yarn.colour} onChange={update('colour')} placeholder="Raw white" />
        </FormField>
        <FormField label="Reorder level (kg)" error={fieldErrors.reorderLevelKg} hint="Warn when stock falls below this">
          <input className="input" type="number" min="0" step="0.01" required value={yarn.reorderLevelKg} onChange={update('reorderLevelKg')} />
        </FormField>
      </form>
    </Modal>
  );
}
