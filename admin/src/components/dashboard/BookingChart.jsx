import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

function BookingChart({ data = [], loading = false }) {
  const chartDomain = useMemo(() => {
    const values = data.map((row) => Number(row.bookings) || 0);
    const max = Math.max(...values, 0);

    if (max === 0) return [0, 10];

    const paddedMax = Math.ceil(max * 1.2);
    const step = paddedMax <= 10 ? 2 : paddedMax <= 50 ? 10 : Math.ceil(paddedMax / 4 / 10) * 10;
    const top = Math.ceil(paddedMax / step) * step;

    return [0, top];
  }, [data]);

  const yTicks = useMemo(() => {
    const [, top] = chartDomain;
    if (top <= 10) return [0, 5, 10];
    if (top <= 50) return [0, Math.round(top / 2), top];
    return [0, Math.round(top / 2), top];
  }, [chartDomain]);

  return (
    <section className="booking-chart">
      <h2 className="booking-chart__title">Booking Trends</h2>
      <div className="booking-chart__chart">
        {loading && data.length === 0 ? (
          <div className="booking-chart__empty">Loading booking trends...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="bookingFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f0e8e4" vertical={false} />
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
                domain={chartDomain}
                ticks={yTicks}
                allowDecimals={false}
              />
              <Tooltip
                formatter={(value) => [`${value} bookings`, '']}
                labelFormatter={(label) => `${label}`}
                contentStyle={{
                  borderRadius: '0.65rem',
                  border: '1px solid #f0e8e4',
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                }}
              />
              <Area
                type="monotone"
                dataKey="bookings"
                stroke="#22c55e"
                strokeWidth={2.5}
                fill="url(#bookingFill)"
                dot={false}
                activeDot={{ r: 4, fill: '#22c55e', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

export default BookingChart;
