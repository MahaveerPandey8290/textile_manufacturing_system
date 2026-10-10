import { Truck } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/EmptyState';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { FullPageSpinner } from '../../components/ui/Spinner';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { OrganizationMark } from '../../components/auth/OrganizationMark';
import { useApiQuery } from '../../hooks/useApi';
import { formatDate, formatDateTime, formatNumber, humanize, percent } from '../../utils/format';
import { OrderProgressStepper } from '../orders/OrderProgressStepper';

/** Public, no-login order tracker. Replaces "call the mill and wait for a call back". */
export default function TrackOrderPage() {
  const { organizationCode, trackingToken } = useParams();
  const { data: order, isLoading, error } = useApiQuery(`/public/track/${organizationCode}/${trackingToken}`, undefined, { refetchInterval: 120_000, retry: false });
  if (isLoading) return <FullPageSpinner />;

  return (
    <div className="track-page">
      <div className="track-card stack">
        <div className="track-header">
          <OrganizationMark name={order?.mill.name ?? ''} logoUrl={order?.mill.logoUrl} size={40} />
          <div>
            <strong>{order?.mill.name ?? 'Order tracking'}</strong>
            <div className="muted" style={{ fontSize: 12 }}>Order tracking</div>
          </div>
        </div>
        {error ? (
          <ErrorState error={{ message: 'This tracking link is not valid. Please check the link or contact the mill.' }} />
        ) : (
          <>
            <Card>
              <div className="row row--between" style={{ marginBottom: 18 }}>
                <div>
                  <div className="muted" style={{ fontSize: 12 }}>{order.buyer_name}</div>
                  <h1 style={{ fontSize: 22 }}>{order.order_number}</h1>
                  <div className="soft">{order.fabric_name} · {order.colour} · {formatNumber(order.quantity_meters, 'm')}</div>
                </div>
                <div className="right">
                  <StatusBadge status={order.status} />
                  <div className="cell-sub" style={{ marginTop: 4 }}>Delivery due {formatDate(order.due_date)}</div>
                </div>
              </div>
              <OrderProgressStepper status={order.status} />
            </Card>
            <Card title="Progress">
              <div className="stack" style={{ gap: 12 }}>
                {[
                  ['Woven', order.produced_meters, 'brand'],
                  ['Quality checked & packed', order.passed_meters, 'teal'],
                  ['Delivered', order.dispatched_meters, 'success'],
                ].map(([label, value, tone]) => (
                  <div key={label}>
                    <div className="row row--between" style={{ fontSize: 13, marginBottom: 4 }}>
                      <span>{label}</span>
                      <strong>{formatNumber(value, 'm')} · {percent(value, order.quantity_meters)}%</strong>
                    </div>
                    <ProgressBar value={value} max={order.quantity_meters} tone={tone} />
                  </div>
                ))}
              </div>
            </Card>
            <div className="grid grid--2">
              <Card title="Updates">
                <ul className="timeline">
                  {[...order.timeline].reverse().map((entry, index) => (
                    <li key={index}><strong>{humanize(entry.to_status)}</strong><div className="cell-sub">{formatDateTime(entry.changed_at)}</div></li>
                  ))}
                </ul>
              </Card>
              <Card title="Shipments">
                {order.dispatches.length === 0 && <p className="muted">Nothing shipped yet.</p>}
                {order.dispatches.map((dispatch) => (
                  <div key={dispatch.dispatch_number} className="list__item">
                    <span><Truck size={14} style={{ verticalAlign: -2 }} /> {dispatch.dispatch_number}<div className="cell-sub">{formatDateTime(dispatch.dispatched_at)}</div></span>
                    <strong>{dispatch.total_rolls} rolls · {formatNumber(dispatch.total_meters, 'm')}</strong>
                  </div>
                ))}
              </Card>
            </div>
            <p className="muted" style={{ fontSize: 12, textAlign: 'center' }}>This page updates automatically from the mill floor.</p>
          </>
        )}
      </div>
    </div>
  );
}
