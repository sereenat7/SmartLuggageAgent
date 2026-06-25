import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

function StatusDistribution({ data = [], loading = false }) {
  const chartData = useMemo(
    () => data.filter((item) => Number(item.count) > 0),
    [data],
  );

  const total = useMemo(
    () => data.reduce((sum, item) => sum + (Number(item.count) || 0), 0),
    [data],
  );

  return (
    <section className="status-distribution">
      <h2 className="status-distribution__title">Status Distribution</h2>

      <div className="status-distribution__chart">
        {loading && total === 0 ? (
          <div className="status-distribution__empty">Loading status distribution...</div>
        ) : total === 0 ? (
          <div className="status-distribution__empty">No bookings yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius="58%"
                outerRadius="82%"
                paddingAngle={2}
                stroke="#fff"
                strokeWidth={2}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, _name, props) => [
                  `${value} (${props.payload.percent}%)`,
                  props.payload.label,
                ]}
                contentStyle={{
                  borderRadius: '0.65rem',
                  border: '1px solid #f0e8e4',
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <ul className="status-distribution__legend">
        {data.map((item) => (
          <li key={item.key} className="status-distribution__legend-item">
            <span className="status-distribution__legend-label">
              <span
                className="status-distribution__legend-dot"
                style={{ background: item.color }}
              />
              {item.label}
            </span>
            <span className="status-distribution__legend-value">{item.percent}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default StatusDistribution;
