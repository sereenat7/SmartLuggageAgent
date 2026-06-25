import { useCallback, useEffect, useMemo, useState } from 'react';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { BOOKING_STATUSES, statusStyles } from '../data/bookingsData';
import { fetchBookings } from '../services/bookings';
import './Bookings.css';

function formatPayment(amount) {
  if (!amount) return '—';
  return `₹${amount.toLocaleString('en-IN')}`;
}

function escapeCsvValue(value) {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadBookingsCsv(rows) {
  const headers = ['Booking ID', 'Customer', 'Assigned Agent', 'Pickup', 'Status', 'Payment'];
  const lines = [
    headers.join(','),
    ...rows.map((booking) =>
      [
        booking.id,
        booking.customer.name,
        booking.agent,
        booking.pickupFull || booking.pickup,
        booking.status,
        booking.payment != null ? booking.payment : '',
      ]
        .map(escapeCsvValue)
        .join(','),
    ),
  ];

  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `bookings-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBookings = useCallback(async () => {
    try {
      setError('');
      const data = await fetchBookings();
      setBookings(data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to load bookings. Make sure the backend is running.',
      );
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function init() {
      setLoading(true);
      try {
        const data = await fetchBookings();
        if (active) {
          setBookings(data);
        }
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.message ||
              err.message ||
              'Failed to load bookings. Make sure the backend is running.',
          );
          setBookings([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    init();
    const intervalId = window.setInterval(() => {
      if (active) loadBookings();
    }, 10000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [loadBookings]);

  const filteredBookings = useMemo(() => {
    const query = search.trim().toLowerCase();

    return bookings.filter((booking) => {
      const matchesFilter = activeFilter === 'All' || booking.status === activeFilter;
      const matchesSearch =
        !query ||
        booking.id.toLowerCase().includes(query) ||
        booking.customer.name.toLowerCase().includes(query) ||
        booking.agent.toLowerCase().includes(query) ||
        booking.pickup.toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [bookings, search, activeFilter]);

  const handleExportCsv = () => {
    if (loading) return;
    downloadBookingsCsv(filteredBookings);
  };

  return (
    <div className="bookings-page">
      <div className="bookings-page__header">
        <div className="bookings-page__intro">
          <h2>Bookings</h2>
          <p>
            {loading
              ? 'Loading bookings...'
              : `Manage and track ${bookings.length} luggage pickup booking${bookings.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <button type="button" className="bookings-page__export" onClick={handleExportCsv}>
          <FileDownloadOutlinedIcon />
          Export CSV
        </button>
      </div>

      {error ? <p className="bookings-page__error">{error}</p> : null}

      <div className="bookings-panel">
        <div className="bookings-toolbar">
          <div className="bookings-toolbar__search">
            <span className="bookings-toolbar__search-icon" aria-hidden="true">
              <SearchOutlinedIcon />
            </span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by booking ID or customer..."
              aria-label="Search bookings"
              disabled={loading}
            />
          </div>

          <div className="bookings-filters" role="tablist" aria-label="Filter bookings by status">
            {BOOKING_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                role="tab"
                aria-selected={activeFilter === status}
                className={`bookings-filter${activeFilter === status ? ' bookings-filter--active' : ''}`}
                onClick={() => setActiveFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="bookings-table-wrap">
          <table className="bookings-table">
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Customer</th>
                <th>Assigned Agent</th>
                <th>Pickup</th>
                <th>Status</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="bookings-table__empty">
                    Loading bookings...
                  </td>
                </tr>
              ) : filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="bookings-table__empty">
                    {bookings.length === 0
                      ? 'No bookings yet.'
                      : 'No bookings match your search or filter.'}
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking) => {
                  const statusStyle = statusStyles[booking.status] || statusStyles.Cancelled;

                  return (
                    <tr key={booking.bookingId}>
                      <td className="bookings-table__id">{booking.id}</td>
                      <td>
                        <div className="bookings-customer">
                          <span
                            className="bookings-customer__avatar"
                            style={{ background: booking.customer.color }}
                            aria-hidden="true"
                          >
                            {booking.customer.initials}
                          </span>
                          <span className="bookings-customer__name">{booking.customer.name}</span>
                        </div>
                      </td>
                      <td className="bookings-table__agent">{booking.agent}</td>
                      <td className="bookings-table__location" title={booking.pickupFull || booking.pickup}>
                        {booking.pickup}
                      </td>
                      <td>
                        <span
                          className="bookings-status"
                          style={{ background: statusStyle.bg, color: statusStyle.color }}
                        >
                          {booking.status}
                        </span>
                      </td>
                      <td className="bookings-table__payment">{formatPayment(booking.payment)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Bookings;
