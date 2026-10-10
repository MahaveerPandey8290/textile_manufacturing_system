import { CheckCircle2, ClipboardPen, Pause, Play, Wrench, Zap } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatNumber, formatRelative } from '../../utils/format';

export function MachineCard({ machine, nextJob, canOperate, onLogOutput, onJobAction, onReportBreakdown, onBackInService }) {
  const hasJob = Boolean(machine.job_id);
  const isDown = machine.status === 'BREAKDOWN' || machine.status === 'MAINTENANCE';
  return (
    <article className={`machine-card machine-card--${machine.status}`}>
      <div className="machine-card__head">
        <div>
          <div className="machine-card__code">
            {machine.status === 'RUNNING' && <span className="running-indicator" />}
            {machine.code}
          </div>
          <div className="cell-sub">{machine.name}</div>
        </div>
        <StatusBadge status={machine.status} />
      </div>

      {hasJob ? (
        <div className="machine-card__job">
          <div className="row row--between">
            <strong>{machine.order_number}</strong>
            <span className="mono cell-sub">{machine.job_number}</span>
          </div>
          <div className="cell-sub" style={{ marginBottom: 6 }}>{machine.buyer_name} · {machine.colour}</div>
          <ProgressBar value={machine.produced_quantity} max={machine.planned_quantity} showLabel tone="success" />
          <div className="cell-sub">{formatNumber(machine.produced_quantity)} / {formatNumber(machine.planned_quantity, machine.quantity_unit)}</div>
        </div>
      ) : isDown ? (
        <div className="machine-card__job" style={{ background: 'var(--tone-danger-bg)', color: 'var(--tone-danger-ink)' }}>
          <strong>{machine.downtime_reason ?? 'Stopped'}</strong>
          <div className="cell-sub">since {formatRelative(machine.downtime_started_at)}</div>
        </div>
      ) : (
        <div className="machine-card__job muted">
          {nextJob ? <>Next up: <strong className="soft">{nextJob.job_number}</strong> · {nextJob.order_number}</> : 'No job assigned. Machine is idle.'}
        </div>
      )}

      <div className="machine-card__metrics">
        <div><strong>{formatNumber(machine.output_today, machine.stage === 'SPINNING' ? 'kg' : 'm')}</strong>today</div>
        <div><strong>{formatNumber(machine.hours_today, 'h')}</strong>run today</div>
        <div className="right"><strong>{machine.location ?? '—'}</strong>location</div>
      </div>

      {canOperate && (
        <div className="machine-card__actions">
          {hasJob && (
            <>
              <Button size="sm" icon={ClipboardPen} onClick={() => onLogOutput(machine)}>Log output</Button>
              <Button size="sm" variant="secondary" icon={Pause} onClick={() => onJobAction(machine.job_id, 'hold')}>Hold</Button>
              <Button size="sm" variant="secondary" icon={CheckCircle2} onClick={() => onJobAction(machine.job_id, 'complete')}>Done</Button>
            </>
          )}
          {!hasJob && !isDown && nextJob && (
            <Button size="sm" icon={Play} onClick={() => onJobAction(nextJob.id, 'start')}>Start {nextJob.job_number}</Button>
          )}
          {!isDown && <Button size="sm" variant="ghost" icon={Zap} onClick={() => onReportBreakdown(machine)}>Breakdown</Button>}
          {isDown && <Button size="sm" variant="success" icon={Wrench} onClick={() => onBackInService(machine)}>Back in service</Button>}
        </div>
      )}
    </article>
  );
}
