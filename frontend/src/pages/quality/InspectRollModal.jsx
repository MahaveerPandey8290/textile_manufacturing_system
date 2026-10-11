import { Camera, Minus, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { FormField, fieldErrorsFrom } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { DEFECT_LABELS } from '../../config/statuses';
import { useApiMutation } from '../../hooks/useApi';
import { formatNumber } from '../../utils/format';
import { imageFileToDataUrl } from '../../utils/imageResize';

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
  const [photo, setPhoto] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (roll) {
      setResult('PASS');
      setGrade('A');
      setRemarks('');
      setPhoto(null);
      setPhotoError('');
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

  const handlePhotoSelect = async (file) => {
    if (!file) return;
    setPhotoError('');
    try {
      const dataUrl = await imageFileToDataUrl(file);
      setPhoto(dataUrl);
    } catch (err) {
      setPhotoError(err.message);
    }
  };

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
                  photo: photo || null,
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

          <FormField label="Defect / issue photo (optional)" error={photoError || fieldErrors.photo || fieldErrors.photoUrl} className="span-all">
            <div className="photo-picker">
              {photo ? (
                <div className="photo-preview-box">
                  <img src={photo} alt="Defect preview" className="photo-preview-img" />
                  <div className="photo-preview-actions">
                    <button
                      type="button"
                      className="button button--secondary button--sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera size={14} />
                      <span>Change photo</span>
                    </button>
                    <button
                      type="button"
                      className="button button--ghost button--sm text-danger"
                      onClick={() => {
                        setPhoto(null);
                        setPhotoError('');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      <Trash2 size={14} />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="photo-dropzone"
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handlePhotoSelect(e.dataTransfer.files?.[0]);
                  }}
                >
                  <Camera size={22} className="muted" />
                  <div>
                    <span className="strong">Take or upload a photo of the defect</span>
                    <span className="muted" style={{ display: 'block', fontSize: 12 }}>
                      PNG, JPG or WebP (camera or file, compressed automatically)
                    </span>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  handlePhotoSelect(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>
          </FormField>
        </div>
      </div>
    </Modal>
  );
}
