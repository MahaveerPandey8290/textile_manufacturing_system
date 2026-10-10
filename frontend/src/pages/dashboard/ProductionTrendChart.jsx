import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatNumber } from '../../utils/format';

const STAGE_COLOURS = { WEAVING: '#3b5bdb', DYEING: '#14b8a6', SPINNING: '#f79009' };

/** 14-day output by stage. Rows from the API are (day, stage, quantity); we pivot them per day. */
export function ProductionTrendChart({ rows }) {
  const byDay = new Map();
  rows.forEach(({ day, stage, quantity }) => {
    const entry = byDay.get(day) ?? { day, label: new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) };
    if (stage) entry[stage] = (entry[stage] ?? 0) + quantity;
    byDay.set(day, entry);
  });
  const data = [...byDay.values()];
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1f6" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="#8a94a6" />
        <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="#8a94a6" />
        <Tooltip formatter={(value, name) => [formatNumber(value, name === 'SPINNING' ? 'kg' : 'm'), name.toLowerCase()]} cursor={{ fill: '#f4f6fa' }} />
        <Legend iconType="circle" formatter={(value) => <span style={{ color: '#475467', fontSize: 12 }}>{value.toLowerCase()}</span>} />
        {Object.entries(STAGE_COLOURS).map(([stage, colour]) => (
          <Bar key={stage} dataKey={stage} stackId="output" fill={colour} radius={stage === 'SPINNING' ? [4, 4, 0, 0] : 0} maxBarSize={28} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
