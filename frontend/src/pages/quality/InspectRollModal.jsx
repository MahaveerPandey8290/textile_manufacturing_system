import { Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { FormField, fieldErrorsFrom } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { DEFECT_LABELS } from '../../config/statuses';
import { useApiMutation } from '../../hooks/useApi';
import { formatNumber } from '../../utils/format';

const RESULTS = [
  { id: 'PASS', label: 'Pass', variant: 'success' },
  { id: 'REWORK', label: 'Rework', variant: 'secondary' },
  { id: 'REJECT', label: 'Reject', variant: 'danger' },
];

/** Replaces the paper QC slip: tap defect counts, pick a result, done. */
export function InspectRollModal({ roll, onClose }) {
  const [result, setResult] = useState('PASS');
  const [grade, setGrade] = useState('A');
  const [remarks, setRemarks] = useState('');
  const [defectCounts, setDefectCounts] = useState({});
  useEffect(() => {
    if (roll) {
      setResult('PASS');
      setGrade('A');
      setRemarks('');
      setDefectCounts({});
    }
  }, [roll]);

  const inspect = useApiMutation({
    path: '/quality/inspections',
    invalidate: ['/quality', '/orders', '/dashboard', '/dispatches'],
    successMessage: `Roll ${roll?.roll_number} recorded`,
    onSuccess: onClose,
  });
  const fieldErrors = fieldErrorsFrom(inspect.error);
  const changeCount = (defectType, delta) =>
    setDefectCounts((current) => ({ ...current, [defectType]: Math.max(0, (current[defectType] ?? 0) + delta) }));
  const totalPoints = Object.values(defectCounts).reduce((sum, count) => sum + count, 0);

  return (
    <Modal
      isOpen={Boolean(roll)}
      onClose={onClose}
      title={`Inspect ${roll?.roll_number}`}
      subtitle={roll ? `${roll.order_number} · ${roll.buyer_name} · ${roll.fabric_name} ${roll.colour} · ${formatNumber(roll.length_meters, 'm')} · loom ${roll.machine_code}` : undefined}
      footer={
        <>
          <span className="muted" style={{ marginRight: 'auto' }}>{totalPoints} defect points</span>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant={RESULTS.find((option) => option.id === result).variant === 'danger' ? 'danger' : 'primary'}
            isLoading={inspect.isPending}
            onClick={() =>
              inspect.mutate({
                body: {
                  fabricRollId: roll.id,
                  result,
                  grade: result === 'REJECT' ? null : grade,
                  remarks: remarks || null,
                  defects: Object.entries(defectCounts).filter(([, count]) => count > 0).map(([defectType, occurrences]) => ({ defectType, occurrences })),
                },
              })
            }
          >
            Save inspection
          </Button>
        </>
      }
    >
      <div className="stack" style={{ gap: 16 }}>
        <div>
          <div className="form-field__label" style={{ marginBottom: 8 }}>Defects found</div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {Object.entries(DEFECT_LABELS).map(([defectType, label]) => (
              <div key={defectType} className="row row--between" style={{ flexWrap: 'nowrap', border: '1px solid var(--color-line)', borderRadius: 10, padding: '6px 8px', background: defectCounts[defectType] ? 'var(--tone-warning-bg)' : undefined }}>
                <span style={{ fontSize: 13 }}>{label}</span>
                <div className="row" style={{ gap: 4 }}>
                  <button type="button" className="icon-button" onClick={() => changeCount(defectType, -1)} aria-label={`Fewer ${label}`}><Minus size={14} /></button>
                  <strong style={{ minWidth: 18, textAlign: 'center' }}>{defectCounts[defectType] ?? 0}</strong>
                  <button type="button" className="icon-button" onClick={() => changeCount(defectType, 1)} aria-label={`More ${label}`}><Plus size={14} /></button>
                </div>
              </div>
            ))}
          </div>
          {fieldErrors.defects && <div className="form-field__error">{fieldErrors.defects}</div>}
        </div>
        <div className="form-grid">
          <FormField label="Result">
            <div className="segmented">
              {RESULTS.map((option) => (
                <button key={option.id} type="button" className={result === option.id ? 'is-active' : ''} onClick={() => setResult(option.id)}>{option.label}</button>
              ))}
            </div>
          </FormField>
          {result !== 'REJECT' && (
            <FormField label="Grade" error={fieldErrors.grade}>
              <div className="segmented">
                {['A', 'B', 'C'].map((option) => (
                  <button key={option} type="button" className={grade === option ? 'is-active' : ''} onClick={() => setGrade(option)}>Grade {option}</button>
                ))}
              </div>
            </FormField>
          )}
          <FormField label="Remarks" className="span-all">
            <input className="input" value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder={result === 'PASS' ? 'Optional' : 'What needs fixing?'} maxLength={500} />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}
