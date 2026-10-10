import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { FormField, fieldErrorsFrom } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { useApiMutation } from '../../hooks/useApi';
import { useYarnTypes } from '../../hooks/useLookups';

const emptyFabric = { name: '', construction: '', gsm: '', widthInches: '', yarnTypeId: '', yarnKgPerMeter: '' };
const numberOrNull = (value) => (value === '' ? null : Number(value));

/** A fabric recipe: which yarn it is woven from and how much one meter uses. Orders are taken against these. */
export function NewFabricTypeModal({ isOpen, onClose }) {
  const [fabric, setFabric] = useState(emptyFabric);
  const { data: yarnTypes } = useYarnTypes();
  useEffect(() => {
    if (isOpen) setFabric(emptyFabric);
  }, [isOpen]);

  const create = useApiMutation({
    path: '/inventory/fabric-types',
    invalidate: ['/inventory'],
    successMessage: (created) => `${created.name} recipe added.`,
    onSuccess: onClose,
  });
  const fieldErrors = fieldErrorsFrom(create.error);
  const update = (field) => (event) => setFabric((current) => ({ ...current, [field]: event.target.value }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New fabric recipe"
      subtitle="Orders are taken against a recipe, and its yarn per meter drives the stock check."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="new-fabric-form" isLoading={create.isPending}>Add recipe</Button>
        </>
      }
    >
      <form
        id="new-fabric-form"
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate({
            body: {
              name: fabric.name,
              construction: fabric.construction || null,
              gsm: numberOrNull(fabric.gsm),
              widthInches: numberOrNull(fabric.widthInches),
              yarnTypeId: Number(fabric.yarnTypeId),
              yarnKgPerMeter: Number(fabric.yarnKgPerMeter),
            },
          });
        }}
      >
        <FormField label="Fabric name" error={fieldErrors.name}>
          <input className="input" required minLength={2} maxLength={120} value={fabric.name} onChange={update('name')} placeholder="Cotton poplin" />
        </FormField>
        <FormField label="Construction (optional)" error={fieldErrors.construction}>
          <input className="input" maxLength={60} value={fabric.construction} onChange={update('construction')} placeholder="40x40 / 132x72" />
        </FormField>
        <FormField label="GSM (optional)" error={fieldErrors.gsm}>
          <input className="input" type="number" min="1" step="1" value={fabric.gsm} onChange={update('gsm')} />
        </FormField>
        <FormField label="Width in inches (optional)" error={fieldErrors.widthInches}>
          <input className="input" type="number" min="1" step="0.1" value={fabric.widthInches} onChange={update('widthInches')} />
        </FormField>
        <FormField label="Woven from yarn" error={fieldErrors.yarnTypeId} hint={yarnTypes?.items.length === 0 ? 'Add a yarn type on the Stock tab first' : undefined}>
          <select className="select" required value={fabric.yarnTypeId} onChange={update('yarnTypeId')}>
            <option value="">Choose yarn…</option>
            {yarnTypes?.items.map((yarn) => <option key={yarn.id} value={yarn.id}>{yarn.code} · {yarn.name} · {yarn.colour}</option>)}
          </select>
        </FormField>
        <FormField label="Yarn per meter (kg)" error={fieldErrors.yarnKgPerMeter}>
          <input className="input" type="number" min="0.001" max="10" step="0.001" required value={fabric.yarnKgPerMeter} onChange={update('yarnKgPerMeter')} placeholder="0.12" />
        </FormField>
      </form>
    </Modal>
  );
}
