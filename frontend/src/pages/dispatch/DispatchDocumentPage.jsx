import { ArrowLeft, Printer } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/EmptyState';
import { SkeletonRows } from '../../components/ui/Spinner';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useApiQuery } from '../../hooks/useApi';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '../../utils/format';

/** Delivery challan + tax invoice for one truck, print-ready (Ctrl/Cmd + P). */
export default function DispatchDocumentPage() {
  const { dispatchId } = useParams();
  const navigate = useNavigate();
  const { data: dispatch, isLoading, error } = useApiQuery(`/dispatches/${dispatchId}`);
  if (error) return <ErrorState error={error} />;
  if (isLoading) return <SkeletonRows rows={8} />;

  return (
    <div className="stack">
      <div className="row row--between no-print">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate(-1)}>Back</Button>
        <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print challan &amp; invoice</Button>
      </div>
      <article className="document">
        <header className="document__head">
          <div>
            <div className="document__title">EVEREST TEXTILE MILLS</div>
            <div className="soft">Plot 14, MIDC Textile Park, Bhiwandi 421302 · GSTIN 27AAACE1234F1Z5</div>
          </div>
          <div className="right">
            <div className="document__title" style={{ fontSize: 16 }}>DELIVERY CHALLAN &amp; TAX INVOICE</div>
            <div className="mono">{dispatch.invoice_number}</div>
            <StatusBadge status={dispatch.invoice_status} />
          </div>
        </header>
        <div className="document__parties">
          <div>
            <div className="muted">Bill &amp; ship to</div>
            <strong>{dispatch.buyer_name}</strong>
            <div>{dispatch.buyer_address}</div>
            <div>GSTIN {dispatch.buyer_gst ?? '—'}</div>
          </div>
          <dl className="key-values">
            <div><dt>Invoice date</dt><dd>{formatDate(dispatch.invoice_date)}</dd></div>
            <div><dt>Payment due</dt><dd>{formatDate(dispatch.invoice_due_date)}</dd></div>
            <div><dt>Dispatch</dt><dd className="mono">{dispatch.dispatch_number}</dd></div>
            <div><dt>Order</dt><dd>{dispatch.order_number}</dd></div>
            <div><dt>Truck</dt><dd>{dispatch.vehicle_number}</dd></div>
            <div><dt>Loaded</dt><dd>{formatDateTime(dispatch.dispatched_at)}</dd></div>
          </dl>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>#</th><th>Roll</th><th>Fabric</th><th>Grade</th><th style={{ textAlign: 'right' }}>Weight</th><th style={{ textAlign: 'right' }}>Meters</th></tr>
          </thead>
          <tbody>
            {dispatch.items.map((item, index) => (
              <tr key={item.roll_number}>
                <td>{index + 1}</td>
                <td className="mono">{item.roll_number}</td>
                <td>{dispatch.fabric_name} · {dispatch.colour}</td>
                <td>{item.grade ?? '—'}</td>
                <td className="right">{formatNumber(item.weight_kg, 'kg')}</td>
                <td className="right">{formatNumber(item.length_meters)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="document__totals">
          <div><span>{dispatch.total_rolls} rolls · {formatNumber(dispatch.total_meters, 'm')} × {formatCurrency(dispatch.rate_per_meter)}</span><span>{formatCurrency(dispatch.subtotal)}</span></div>
          <div><span>GST @ {dispatch.tax_percent}%</span><span>{formatCurrency(dispatch.tax_amount)}</span></div>
          <div className="grand"><span>Total</span><span>{formatCurrency(dispatch.total_amount)}</span></div>
          <div className="muted"><span>Received so far</span><span>{formatCurrency(dispatch.amount_paid)}</span></div>
        </div>
        <div className="row row--between" style={{ marginTop: 48, fontSize: 12 }}>
          <span className="muted">Driver: {dispatch.driver_name ?? '—'} {dispatch.driver_phone ?? ''}</span>
          <span>Receiver's signature ____________________</span>
        </div>
      </article>
    </div>
  );
}
