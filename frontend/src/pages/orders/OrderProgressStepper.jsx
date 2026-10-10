import { Check } from 'lucide-react';
import { ORDER_STAGES, STATUS_STYLES } from '../../config/statuses';

// PARTIALLY_DISPATCHED sits between ready and delivered on the buyer-facing stepper.
const STAGE_POSITION = { ...Object.fromEntries(ORDER_STAGES.map((stage, index) => [stage, index])), PARTIALLY_DISPATCHED: 3.5 };
const STEP_LABELS = { NEW: 'Order received', IN_PRODUCTION: 'Weaving & dyeing', QUALITY_CHECK: 'Quality check', READY_TO_DISPATCH: 'Ready to ship', DISPATCHED: 'Delivered' };

export function OrderProgressStepper({ status }) {
  if (status === 'CANCELLED') return <div className="callout callout--danger">This order was cancelled.</div>;
  const currentPosition = STAGE_POSITION[status];
  return (
    <div className="stepper">
      {ORDER_STAGES.map((stage, index) => {
        const isDone = index < currentPosition || (stage === 'DISPATCHED' && status === 'DISPATCHED');
        const isCurrent = !isDone && index === Math.ceil(currentPosition);
        return (
          <div key={stage} className={`stepper__step ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`}>
            <span className="stepper__dot">{isDone ? <Check size={16} /> : index + 1}</span>
            <span>{STEP_LABELS[stage]}</span>
            {isCurrent && status === 'PARTIALLY_DISPATCHED' && <span className="cell-sub">{STATUS_STYLES[status].label}</span>}
          </div>
        );
      })}
    </div>
  );
}
