import { ArrowLeft, Ban, Boxes, Copy, Factory, Link2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { ErrorState } from '../../components/ui/EmptyState';
import { FormField } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { SkeletonRows } from '../../components/ui/Spinner';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/Toast';
import { STAGE_LABELS } from '../../config/statuses';
import { useApiMutation, useApiQuery } from '../../hooks/useApi';
import { formatCurrency, formatDate, formatDateTime, formatNumber, humanize, percent } from '../../utils/format';
import { IssueYarnModal } from '../inventory/IssueYarnModal';
import { PlanJobModal } from '../production/PlanJobModal';
import { OrderProgressStepper } from './OrderProgressStepper';

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { currentUser, organization, hasRole } = useAuth();
  const { showToast } = useToast();
  const isBuyer = currentUser.role === 'BUYER';
  const [activeTab, setActiveTab] = useState('rolls');
  const [openModal, setOpenModal] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const { data: order, isLoading, error, refetch } = useApiQuery(`/orders/${orderId}`);

  const cancelOrder = useApiMutation({
    path: `/orders/${orderId}/cancel`,
    invalidate: ['/orders', '/dashboard', '/production'],
    successMessage: 'Order cancelled',
    onSuccess: () => setOpenModal(null),
  });

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading) return <SkeletonRows rows={10} />;

  const isClosed = ['DISPATCHED', 'CANCELLED'].includes(order.status);
  const trackingPath = `/track/${organization.code}/${order.tracking_token}`;
  const trackingUrl = `${window.location.origin}${trackingPath}`;
  const orderValue = order.quantity_meters * order.rate_per_meter;
  const copyTrackingLink = async () => {
    await navigator.clipboard.writeText(trackingUrl);
    showToast({ message: 'Tracking link copied. Share it with the buyer.' });
  };

  return (
    <div className="stack">
      <div>
        <button className="button button--ghost button--sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>
      </div>
      <PageHeader
        eyebrow={order.buyer_name}
        title={
          <span className="row">
            {order.order_number} <StatusBadge status={order.status} /> <StatusBadge status={order.priority} />
          </span>
        }
        description={`${order.fabric_name} · ${order.colour} · ${formatNumber(order.quantity_meters, 'm')} · due ${formatDate(order.due_date)}`}
        actions={
          <>
            <Button variant="secondary" icon={Copy} onClick={copyTrackingLink}>Copy tracking link</Button>
            {!isClosed && hasRole('STORE_MANAGER', 'PRODUCTION_MANAGER') && (
              <Button variant="secondary" icon={Boxes} onClick={() => setOpenModal('issue')}>Issue yarn</Button>
            )}
            {!isClosed && hasRole('PRODUCTION_MANAGER') && <Button icon={Factory} onClick={() => setOpenModal('plan')}>Plan job</Button>}
            {!isClosed && order.dispatched_meters === 0 && hasRole('PRODUCTION_MANAGER', 'ACCOUNTANT') && (
              <Button variant="ghost" icon={Ban} onClick={() => setOpenModal('cancel')}>Cancel</Button>
            )}
          </>
        }
      />

      <Card>
        <OrderProgressStepper status={order.status} />
      </Card>

      <div className="grid grid--main-side">
        <Card title="Where the fabric is" subtitle="Meters, measured from rolls on the floor">
          <div className="stack" style={{ gap: 14 }}>
            {[
              { label: 'Woven (excl. rejected)', value: order.produced_meters, tone: 'brand' },
              { label: 'Passed quality check', value: order.passed_meters, tone: 'teal' },
              { label: 'Dispatched to buyer', value: order.dispatched_meters, tone: 'success' },
            ].map((row) => (
              <div key={row.label}>
                <div className="row row--between" style={{ fontSize: 13, marginBottom: 6 }}>
                  <span>{row.label}</span>
                  <span>
                    <strong>{formatNumber(row.value, 'm')}</strong> <span className="muted">of {formatNumber(order.quantity_meters)} · {percent(row.value, order.quantity_meters)}%</span>
                  </span>
                </div>
                <ProgressBar value={row.value} max={order.quantity_meters} tone={row.tone} />
              </div>
            ))}
            <div className="summary-strip">
              <div><span className="muted">Rolls</span><strong>{order.roll_count}</strong></div>
              <div><span className="muted">Waiting for QC</span><strong>{formatNumber(order.pending_qc_meters, 'm')}</strong></div>
              <div><span className="muted">Rejected</span><strong className={order.rejected_meters ? 'text-danger' : ''}>{formatNumber(order.rejected_meters, 'm')}</strong></div>
            </div>
          </div>
        </Card>
        {isBuyer ? (
          <Card title="Status history">
            <Timeline entries={order.timeline} />
          </Card>
        ) : (
          <Card title="Order economics" subtitle="Actual cost so far vs. order value">
            <dl className="key-values" style={{ marginBottom: 16 }}>
              <div><dt>Order value</dt><dd>{formatCurrency(orderValue)}</dd></div>
              <div><dt>Cost so far</dt><dd>{formatCurrency(order.total_cost)}</dd></div>
              <div><dt>Projected margin</dt><dd className={orderValue - order.total_cost < 0 ? 'text-danger' : 'text-success'}>{formatCurrency(orderValue - order.total_cost)}</dd></div>
              <div><dt>Rate</dt><dd>{formatCurrency(order.rate_per_meter)}/m</dd></div>
            </dl>
            <div className="cost-bar">
              {[
                ['Yarn', order.material_cost, 'brand'],
                ['Labour', order.labour_cost, 'teal'],
                ['Machine time', order.machine_cost, 'purple'],
              ].map(([label, value, tone]) => (
                <div key={label} className="cost-bar__row">
                  <span>{label}</span>
                  <ProgressBar value={value} max={Math.max(order.total_cost, 1)} tone={tone} />
                  <span className="right strong">{formatCurrency(value)}</span>
                </div>
              ))}
            </div>
            {order.yarnAvailability && (
              <div className={`callout ${order.yarnAvailability.stillNeededKg === 0 ? 'callout--success' : order.yarnAvailability.canStart ? 'callout--info' : 'callout--warning'}`} style={{ marginTop: 16 }}>
                <Boxes size={16} />
                <div>
                  {order.yarnAvailability.stillNeededKg === 0
                    ? `All ${formatNumber(order.yarnAvailability.requiredKg, 'kg')} of yarn has been issued.`
                    : `${formatNumber(order.yarnAvailability.stillNeededKg, 'kg')} more ${order.yarnAvailability.yarnName} needed; ${formatNumber(order.yarnAvailability.availableKg, 'kg')} in store${order.yarnAvailability.shortfallKg ? `, short by ${formatNumber(order.yarnAvailability.shortfallKg, 'kg')}` : ''}.`}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      <Card padded={false}>
        <div className="card__body">
          <Tabs
            activeTab={activeTab}
            onChange={setActiveTab}
            tabs={[
              { id: 'rolls', label: 'Rolls', count: order.rolls.length },
              ...(isBuyer ? [] : [{ id: 'jobs', label: 'Production jobs', count: order.jobs.length }]),
              { id: 'dispatches', label: 'Dispatches', count: order.dispatches.length },
              { id: 'invoices', label: 'Invoices', count: order.invoices.length },
              ...(isBuyer ? [] : [{ id: 'history', label: 'History' }]),
            ]}
          />
          {activeTab === 'rolls' && (
            <DataTable
              rows={order.rolls}
              emptyTitle="No rolls yet"
              emptyDescription="Rolls appear here as soon as they come off the loom."
              onRowClick={isBuyer ? undefined : (roll) => navigate(`/quality?roll=${roll.id}`)}
              columns={[
                { key: 'roll_number', header: 'Roll', render: (roll) => <span className="mono strong">{roll.roll_number}</span> },
                { key: 'length_meters', header: 'Length', align: 'right', render: (roll) => formatNumber(roll.length_meters, 'm') },
                { key: 'weight_kg', header: 'Weight', align: 'right', render: (roll) => formatNumber(roll.weight_kg, 'kg') },
                { key: 'grade', header: 'Grade', render: (roll) => roll.grade ?? '—' },
                ...(isBuyer ? [] : [{ key: 'machine_code', header: 'Loom', render: (roll) => <span className="chip">{roll.machine_code}</span> }, { key: 'rack_location', header: 'Rack' }]),
                { key: 'status', header: 'Status', render: (roll) => <StatusBadge status={roll.status} /> },
              ]}
            />
          )}
          {activeTab === 'jobs' && (
            <DataTable
              rows={order.jobs}
              emptyTitle="Not planned on any machine yet"
              columns={[
                { key: 'job_number', header: 'Job', render: (job) => <span className="mono strong">{job.job_number}</span> },
                { key: 'stage', header: 'Stage', render: (job) => STAGE_LABELS[job.stage] },
                { key: 'machine', header: 'Machine', render: (job) => <><span className="chip">{job.machine_code}</span> <span className="cell-sub">{job.machine_name}</span></> },
                { key: 'progress', header: 'Output', width: 220, render: (job) => <><ProgressBar value={job.produced_quantity} max={job.planned_quantity} showLabel /><div className="cell-sub">{formatNumber(job.produced_quantity)} / {formatNumber(job.planned_quantity, job.quantity_unit)}</div></> },
                { key: 'started_at', header: 'Started', render: (job) => formatDateTime(job.started_at) },
                { key: 'status', header: 'Status', render: (job) => <StatusBadge status={job.status} /> },
              ]}
            />
          )}
          {activeTab === 'dispatches' && (
            <DataTable
              rows={order.dispatches}
              emptyTitle="Nothing dispatched yet"
              onRowClick={(dispatch) => navigate(`/dispatch/${dispatch.id}`)}
              columns={[
                { key: 'dispatch_number', header: 'Dispatch', render: (dispatch) => <span className="mono strong">{dispatch.dispatch_number}</span> },
                { key: 'dispatched_at', header: 'Date', render: (dispatch) => formatDateTime(dispatch.dispatched_at) },
                { key: 'vehicle_number', header: 'Vehicle' },
                { key: 'total_rolls', header: 'Rolls', align: 'right' },
                { key: 'total_meters', header: 'Meters', align: 'right', render: (dispatch) => formatNumber(dispatch.total_meters) },
                { key: 'invoice_number', header: 'Invoice', render: (dispatch) => <span className="mono">{dispatch.invoice_number}</span> },
              ]}
            />
          )}
          {activeTab === 'invoices' && (
            <DataTable
              rows={order.invoices}
              emptyTitle="No invoices yet"
              columns={[
                { key: 'invoice_number', header: 'Invoice', render: (invoice) => <span className="mono strong">{invoice.invoice_number}</span> },
                { key: 'invoice_date', header: 'Date', render: (invoice) => formatDate(invoice.invoice_date) },
                { key: 'due_date', header: 'Due', render: (invoice) => formatDate(invoice.due_date) },
                { key: 'total_amount', header: 'Amount', align: 'right', render: (invoice) => formatCurrency(invoice.total_amount) },
                { key: 'amount_paid', header: 'Paid', align: 'right', render: (invoice) => formatCurrency(invoice.amount_paid) },
                { key: 'status', header: 'Status', render: (invoice) => <StatusBadge status={invoice.status} /> },
              ]}
            />
          )}
          {activeTab === 'history' && <Timeline entries={order.timeline} />}
        </div>
      </Card>

      {!isBuyer && (
        <p className="muted row" style={{ fontSize: 12 }}>
          <Link2 size={12} /> Public tracking page: <Link to={trackingPath} target="_blank">{trackingUrl}</Link>
        </p>
      )}

      {/* Mounted only when opened, so their lookups never run for roles that cannot use them. */}
      {openModal === 'plan' && <PlanJobModal isOpen onClose={() => setOpenModal(null)} order={order} />}
      {openModal === 'issue' && <IssueYarnModal
        isOpen
        onClose={() => setOpenModal(null)}
        order={order}
        suggestedYarnTypeId={order.yarnAvailability?.yarnTypeId}
        suggestedKg={Math.min(order.yarnAvailability?.stillNeededKg ?? 0, order.yarnAvailability?.availableKg ?? 0)}
      />}
      <Modal
        isOpen={openModal === 'cancel'}
        onClose={() => setOpenModal(null)}
        title={`Cancel ${order.order_number}?`}
        subtitle="Planned and running jobs will be put on hold. This cannot be undone."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpenModal(null)}>Keep order</Button>
            <Button variant="danger" isLoading={cancelOrder.isPending} disabled={cancelReason.trim().length < 3} onClick={() => cancelOrder.mutate({ body: { reason: cancelReason } })}>
              Cancel order
            </Button>
          </>
        }
      >
        <FormField label="Reason">
          <textarea className="textarea" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="e.g. Buyer withdrew the order" />
        </FormField>
      </Modal>
    </div>
  );
}

function Timeline({ entries }) {
  return (
    <ul className="timeline">
      {entries.map((entry, index) => (
        <li key={index}>
          <strong>{humanize(entry.to_status)}</strong>
          {entry.note && <span className="soft"> · {entry.note}</span>}
          <div className="cell-sub">
            {formatDateTime(entry.changed_at)}
            {entry.changed_by_name && ` · ${entry.changed_by_name}`}
          </div>
        </li>
      ))}
    </ul>
  );
}
