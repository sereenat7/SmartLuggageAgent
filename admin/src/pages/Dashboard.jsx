import { useCallback, useEffect, useMemo, useState } from 'react';
import PeopleOutlineOutlinedIcon from '@mui/icons-material/PeopleOutlineOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import StatCard from '../components/dashboard/StatCard';
import BookingChart from '../components/dashboard/BookingChart';
import StatusDistribution from '../components/dashboard/StatusDistribution';
import RevenueOverview from '../components/dashboard/RevenueOverview';
import { fetchDashboardStats } from '../services/dashboard';

function formatCount(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

function formatRevenue(value) {
  const amount = Number(value) || 0;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

const statConfig = [
  {
    key: 'totalUsers',
    label: 'Total Users',
    icon: <PeopleOutlineOutlinedIcon />,
    iconBg: '#fee2e2',
    iconColor: '#ef4444',
    format: formatCount,
  },
  {
    key: 'totalAgents',
    label: 'Total Agents',
    icon: <BadgeOutlinedIcon />,
    iconBg: '#ede9fe',
    iconColor: '#8b5cf6',
    format: formatCount,
  },
  {
    key: 'activeBookings',
    label: 'Active Bookings',
    icon: <Inventory2OutlinedIcon />,
    iconBg: '#ffedd5',
    iconColor: '#f97316',
    format: formatCount,
  },
  {
    key: 'completedDeliveries',
    label: 'Completed Deliveries',
    icon: <CheckCircleOutlineOutlinedIcon />,
    iconBg: '#dcfce7',
    iconColor: '#22c55e',
    format: formatCount,
  },
  {
    key: 'totalRevenue',
    label: 'Total Revenue',
    icon: <CreditCardOutlinedIcon />,
    iconBg: '#fef9c3',
    iconColor: '#eab308',
    format: formatRevenue,
  },
  {
    key: 'pendingComplaints',
    label: 'Pending Complaints',
    icon: <ReportProblemOutlinedIcon />,
    iconBg: '#fee2e2',
    iconColor: '#ef4444',
    format: formatCount,
    invertTrend: true,
  },
];

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = useCallback(async () => {
    try {
      setError('');
      const data = await fetchDashboardStats();
      setStats(data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to load dashboard. Make sure the admin backend is running.',
      );
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function init() {
      setLoading(true);
      try {
        const data = await fetchDashboardStats();
        if (active) setStats(data);
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.message ||
              err.message ||
              'Failed to load dashboard. Make sure the admin backend is running.',
          );
          setStats(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    init();
    const intervalId = window.setInterval(() => {
      if (active) loadStats();
    }, 30000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [loadStats]);

  const cards = useMemo(() => {
    if (!stats) return [];

    return statConfig.map((item) => {
      const trendInfo = stats.trends?.[item.key];
      const trendUp = item.invertTrend ? !trendInfo?.up : trendInfo?.up;

      return {
        label: item.label,
        value: loading ? '—' : item.format(stats[item.key]),
        trend: trendInfo?.value ?? null,
        trendUp: trendUp ?? true,
        icon: item.icon,
        iconBg: item.iconBg,
        iconColor: item.iconColor,
      };
    });
  }, [stats, loading]);

  return (
    <>
      {error ? <p className="dashboard-error">{error}</p> : null}

      <div className="dashboard-stats">
        {cards.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <BookingChart data={stats?.bookingTrends || []} loading={loading} />

      <StatusDistribution
        data={stats?.statusDistribution || []}
        loading={loading}
      />

      <RevenueOverview data={stats?.revenueOverview || []} loading={loading} />
    </>
  );
}

export default Dashboard;
