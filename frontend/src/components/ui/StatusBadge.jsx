import { STATUS_STYLES } from '../../config/statuses';
import { humanize } from '../../utils/format';

export function StatusBadge({ status, label }) {
  const style = STATUS_STYLES[status] ?? { label: humanize(status), tone: 'neutral' };
  return (
    <span className={`badge badge--${style.tone}`}>
      <span className="badge__dot" />
      {label ?? style.label}
    </span>
  );
}
