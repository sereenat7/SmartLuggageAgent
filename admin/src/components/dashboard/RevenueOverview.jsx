import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function formatRevenueAmount(value) {
  const amount = Number(value) || 0;
  return `₹${amount.toLocaleString('en-IN')}`;
}

function buildYAxisScale(peak) {
  if (peak === 0) {
    return {
      domain: [0, 10],
      ticks: [0, 2.5, 5, 7.5, 10],
      formatTick: (value) => `₹${value}`,
    };
  }

  if (peak >= 100000) {
    const padded = Math.ceil((peak * 1.2) / 25000) * 25000;
    const step = padded / 4;
    return {
      domain: [0, padded],
      ticks: [0, step, step * 2, step * 3, padded],
      formatTick: (value) => `${(value / 100000).toFixed(1)}L`,
    };
  }

  if (peak >= 1000) {
    const padded = Math.ceil((peak * 1.2) / 250) * 250;
    const step = padded / 4;
    return {
      domain: [0, padded],
      ticks: [0, step, step * 2, step * 3, padded],
      formatTick: (value) => `₹${(value / 1000).toFixed(1)}K`,
    };
  }

  const padded = Math.max(Math.ceil(peak * 1.25), peak + 2);
  const top = padded <= 10 ? 10 : Math.ceil(padded / 5) * 5;
  const step = top / 4;

  return {
    domain: [0, top],
    ticks: [0, step, step * 2, step * 3, top],
    formatTick: (value) => `₹${Number.isInteger(value) ? value : value.toFixed(1)}`,
  };
}

function RevenueOverview({ data = [], loading = false }) {
  const yAxis = useMemo(() => {
    const peak = Math.max(...data.map((row) => Number(row.revenue) || 0), 0);
    return buildYAxisScale(peak);
  }, [data]);

  return (
    <section className="revenue-overview">
      <h2 className="revenue-overview__title">Revenue Overview</h2>
      <div className="revenue-overview__chart">
        {loading && data.length === 0 ? (
          <div className="revenue-overview__empty">Loading revenue overview...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }} barCategoryGap="18%">
              <defs>
                <linearGradient id="revenueBarGradient" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#dc2626" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f0e8e4" strokeDasharray="4 4" vertical />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                domain={yAxis.domain}
                ticks={yAxis.ticks}
                tickFormatter={yAxis.formatTick}
                allowDecimals
              />
              <Tooltip
                formatter={(value) => [formatRevenueAmount(value), 'Revenue']}
                labelFormatter={(label) => `${label}`}
                contentStyle={{
                  borderRadius: '0.65rem',
                  border: '1px solid #f0e8e4',
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                }}
              />
              <Bar
                dataKey="revenue"
                fill="url(#revenueBarGradient)"
                radius={[6, 6, 0, 0]}
                maxBarSize={42}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

export default RevenueOverview;
