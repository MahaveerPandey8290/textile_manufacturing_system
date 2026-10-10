import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { FormField, fieldErrorsFrom } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { useApiMutation, useApiQuery } from '../../hooks/useApi';

/** A roll comes off the loom: record it so it is traceable from this moment on. */
export function NewRollModal({ isOpen, onClose }) {
  const [form, setForm] = useState({ productionJobId: '', lengthMeters: '', weightKg: '', rackLocation: '' });
  const { data: jobs } = useApiQuery('/production/jobs', undefined, { enabled: isOpen });
  useEffect(() => {
    if (isOpen) setForm({ productionJobId: '', lengthMeters: '', weightKg: '', rackLocation: '' });
  }, [isOpen]);
  const createRoll = useApiMutation({
    path: '/quality/rolls',
    invalidate: ['/quality', '/orders', '/dashboard'],
    successMessage: (roll) => `${roll.roll_number} created and queued for QC`,
    onSuccess: onClose,
  });
  const fieldErrors = fieldErrorsFrom(createRoll.error);
  // Rolls can still be cut after a job is marked done, as long as the order hasn't shipped.
  const fabricJobs = jobs?.filter((job) => job.stage !== 'SPINNING' && !['DISPATCHED', 'CANCELLED'].includes(job.order_status)) ?? [];
  const selectedJob = fabricJobs.find((job) => String(job.id) === String(form.productionJobId));
  const updateField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New roll off the loom"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="new-roll-form" isLoading={createRoll.isPending}>Create roll</Button>
        </>
      }
    >
      <form
        id="new-roll-form"
        className="stack"
        style={{ gap: 14 }}
        onSubmit={(event) => {
          event.preventDefault();
          createRoll.mutate({
            body: {
              orderId: selectedJob.order_id,
              machineId: selectedJob.machine_id,
              productionJobId: selectedJob.id,
              lengthMeters: Number(form.lengthMeters),
              weightKg: form.weightKg ? Number(form.weightKg) : null,
              rackLocation: form.rackLocation || null,
            },
          });
        }}
      >
        <FormField label="From job" hint={selectedJob ? `${selectedJob.order_number} · ${selectedJob.buyer_name} · ${selectedJob.machine_code}` : jobs && !fabricJobs.length ? 'No weaving or dyeing job yet. Plan one on the Production floor first.' : 'Weaving or dyeing job'}>
          <select className="select" required value={form.productionJobId} onChange={updateField('productionJobId')}>
            <option value="">Choose job…</option>
            {fabricJobs.map((job) => <option key={job.id} value={job.id}>{job.job_number} · {job.order_number} · {job.machine_code}{job.status === 'COMPLETED' ? ' (done)' : ''}</option>)}
          </select>
        </FormField>
        <div className="form-grid">
          <FormField label="Length (m)" error={fieldErrors.lengthMeters}>
            <input className="input" type="number" min="0.1" step="0.1" required value={form.lengthMeters} onChange={updateField('lengthMeters')} />
          </FormField>
          <FormField label="Weight (kg)">
            <input className="input" type="number" min="0.1" step="0.1" value={form.weightKg} onChange={updateField('weightKg')} />
          </FormField>
        </div>
        <FormField label="Rack location">
          <input className="input" value={form.rackLocation} onChange={updateField('rackLocation')} placeholder="R2-B4" maxLength={30} />
        </FormField>
      </form>
    </Modal>
  );
}
