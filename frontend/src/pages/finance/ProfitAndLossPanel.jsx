import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/EmptyState';
import { SkeletonRows } from '../../components/ui/Spinner';
import { StatCard } from '../../components/ui/StatCard';
import { useApiQuery } from '../../hooks/useApi';
import { currentMonthIso, formatCurrency, formatRupeesShort } from '../../utils/format';

/** "Did the mill make money this month?" — answered from data, not from a notebook. */
export function ProfitAndLossPanel() {
  const [month, setMonth] = useState(currentMonthIso());
  const { data: report, isLoading, error } = useApiQuery('/reports/profit-and-loss', { month });
  return (
    <div className="stack">
      <div className="toolbar">
        <input className="input select-sm" type="month" value={month} max={currentMonthIso()} onChange={(event) => setMonth(event.target.value)} aria-label="Month" />
        {report && <span className="soft">Wages from {report.costs.wagesSource}</span>}
      </div>
      {error && <ErrorState error={error} />}
      {isLoading && <SkeletonRows rows={4} />}
      {report && (
        <>
          <div className="grid grid--stats">
            <StatCard label="Revenue (billed)" value={formatRupeesShort(report.revenue)} tone="brand" />
            <StatCard label="Total cost" value={formatRupeesShort(report.costs.total)} tone="warning" />
            <StatCard label="Operating profit" value={formatRupeesShort(report.operatingProfit)} hint={report.profitMarginPercent !== null ? `${report.profitMarginPercent}% margin` : undefined} tone={report.operatingProfit >= 0 ? 'success' : 'danger'} />
            <StatCard label="Net cash flow" value={formatRupeesShort(report.cash.net)} hint="money in minus money out" tone={report.cash.net >= 0 ? 'teal' : 'danger'} />
          </div>
          <div className="grid grid--2">
            <Card title="Profit & loss" subtitle="Accrual view: what we billed vs. what production consumed">
              <Statement
                rows={[
                  ['Sales billed (excl. GST)', report.revenue, 'strong'],
                  ['Yarn consumed', -report.costs.yarnConsumed],
                  ['Machine running cost', -report.costs.machineRunning],
                  ['Worker wages', -report.costs.wages],
                  ['Operating profit', report.operatingProfit, 'total'],
                ]}
              />
            </Card>
            <Card title="Cash" subtitle="What actually moved through the bank">
              <Statement
                rows={[
                  ['Received from buyers', report.cash.fromBuyers, 'strong'],
                  ['Paid to yarn suppliers', -report.cash.toSuppliers],
                  ['Wages paid out', -report.cash.wagesPaid],
                  ['Net cash', report.cash.net, 'total'],
                  ['Yarn purchased this month (for reference)', report.yarnPurchased, 'muted'],
                ]}
              />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Statement({ rows }) {
  return (
    <div className="list">
      {rows.map(([label, value, style]) => (
        <div key={label} className="list__item" style={style === 'total' ? { borderTop: '2px solid var(--color-ink)', fontWeight: 700, fontSize: 15 } : undefined}>
          <span className={style === 'muted' ? 'muted' : ''}>{label}</span>
          <span className={`${style === 'strong' || style === 'total' ? 'strong' : ''} ${value < 0 ? 'text-danger' : ''} ${style === 'muted' ? 'muted' : ''}`}>{formatCurrency(value)}</span>
        </div>
      ))}
    </div>
  );
}
