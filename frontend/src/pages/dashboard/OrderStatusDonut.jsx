import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { STATUS_STYLES } from '../../config/statuses';

const TONE_COLOURS = { neutral: '#98a2b3', info: '#2e90fa', purple: '#7a5af8', success: '#12b76a', teal: '#15b79e', 'success-strong': '#067647', muted: '#d0d5dd' };

export function OrderStatusDonut({ byStatus }) {
  const data = Object.entries(byStatus ?? {}).map(([status, count]) => ({
    status,
    label: STATUS_STYLES[status]?.label ?? status,
    count,
    colour: TONE_COLOURS[STATUS_STYLES[status]?.tone] ?? '#98a2b3',
  }));
  const total = data.reduce((sum, item) => sum + item.count, 0);
  return (
    <div className="row" style={{ alignItems: 'center', flexWrap: 'nowrap' }}>
      <div style={{ width: 150, height: 150, position: 'relative' }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="label" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none">
              {data.map((item) => (
                <Cell key={item.status} fill={item.colour} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', textAlign: 'center' }}>
          <div>
            <strong style={{ fontSize: 22 }}>{total}</strong>
            <div className="muted" style={{ fontSize: 11 }}>orders</div>
          </div>
        </div>
      </div>
      <div className="list" style={{ flex: 1 }}>
        {data.map((item) => (
          <div key={item.status} className="row row--between" style={{ padding: '4px 0', fontSize: 13 }}>
            <span>
              <span className="legend__swatch" style={{ background: item.colour }} />
              {item.label}
            </span>
            <strong>{item.count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
