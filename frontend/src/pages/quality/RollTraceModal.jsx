import { Modal } from '../../components/ui/Modal';
import { SkeletonRows } from '../../components/ui/Spinner';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { DEFECT_LABELS, STAGE_LABELS } from '../../config/statuses';
import { useApiQuery } from '../../hooks/useApi';
import { formatDateTime, formatNumber } from '../../utils/format';

/** Roll → order → buyer → machine → job → inspections → truck. A defect can always be traced to its cause. */
export function RollTraceModal({ rollId, onClose }) {
  const { data: roll, isLoading } = useApiQuery(`/quality/rolls/${rollId}`, undefined, { enabled: Boolean(rollId) });
  return (
    <Modal isOpen={Boolean(rollId)} onClose={onClose} title={roll ? `Roll ${roll.roll_number}` : 'Roll'} subtitle="Full traceability" size="lg">
      {isLoading || !roll ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="stack">
          <div className="row"><StatusBadge status={roll.status} /><span className="soft">{formatNumber(roll.length_meters, 'm')} · {formatNumber(roll.weight_kg, 'kg')} · rack {roll.rack_location ?? '—'}</span></div>
          <dl className="key-values">
            <div><dt>Order</dt><dd>{roll.order_number}</dd></div>
            <div><dt>Buyer</dt><dd>{roll.buyer_name}</dd></div>
            <div><dt>Fabric</dt><dd>{roll.fabric_name} · {roll.colour}</dd></div>
            <div><dt>Made on</dt><dd>{roll.machine_code} ({STAGE_LABELS[roll.machine_stage]})</dd></div>
            <div><dt>Job</dt><dd className="mono">{roll.job_number ?? '—'}</dd></div>
            <div><dt>Doffed</dt><dd>{formatDateTime(roll.created_at)}</dd></div>
            <div><dt>Dispatch</dt><dd>{roll.dispatch_number ? `${roll.dispatch_number} · ${roll.vehicle_number}` : 'On shelf'}</dd></div>
          </dl>
          <div>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Inspections</h3>
            {roll.inspections.length === 0 && <p className="muted">Not inspected yet.</p>}
            <ul className="timeline">
              {roll.inspections.map((inspection) => (
                <li key={inspection.id}>
                  <strong>{inspection.result}</strong> {inspection.grade && `· grade ${inspection.grade}`} · {inspection.defect_points} points
                  <div className="cell-sub">{formatDateTime(inspection.inspected_at)} · {inspection.inspector_name}</div>
                  {inspection.defects.length > 0 && <div className="soft">{inspection.defects.map((defect) => `${DEFECT_LABELS[defect.defectType]} ×${defect.occurrences}`).join(', ')}</div>}
                  {inspection.remarks && <div className="soft">“{inspection.remarks}”</div>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  );
}
