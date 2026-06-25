import { useCallback, useEffect, useState } from 'react';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined';
import HighlightOffOutlinedIcon from '@mui/icons-material/HighlightOffOutlined';
import { paymentStatusStyles, summaryCardConfig } from '../data/paymentsData';
import { fetchPayments } from '../services/payments';
import './Payments.css';

const summaryIcons = {
  card: CreditCardOutlinedIcon,
  clock: ScheduleOutlinedIcon,
  refund: ReplayOutlinedIcon,
  failed: HighlightOffOutlinedIcon,
};

const defaultSummary = {
  collected: '₹0',
  pending: '₹0',
  refunded: '₹0',
  failed: '₹0',
};

function formatAmount(amount) {
  if (!amount) return '—';
  return `₹${amount.toLocaleString('en-IN')}`;
}

function Payments() {
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(defaultSummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPayments = useCallback(async () => {
    try {
      setError('');
      const data = await fetchPayments();
      setPayments(data.payments);
      setSummary(data.summary || defaultSummary);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to load payments. Make sure the backend is running.',
      );
      setPayments([]);
      setSummary(defaultSummary);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function init() {
      setLoading(true);
      try {
        const data = await fetchPayments();
        if (active) {
          setPayments(data.payments);
          setSummary(data.summary || defaultSummary);
        }
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.message ||
              err.message ||
              'Failed to load payments. Make sure the backend is running.',
          );
          setPayments([]);
          setSummary(defaultSummary);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    init();
    const intervalId = window.setInterval(() => {
      if (active) loadPayments();
    }, 10000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [loadPayments]);

  return (
    <div className="payments-page">
      <div className="payments-page__intro">
        <h2>Payments</h2>
        <p>
          {loading
            ? 'Loading transaction history...'
            : 'Transaction history and financial overview'}
        </p>
      </div>

      {error ? <p className="payments-page__error">{error}</p> : null}

      <div className="payments-summary">
        {summaryCardConfig.map((item) => {
          const Icon = summaryIcons[item.icon];

          return (
            <article key={item.id} className="payments-summary__card">
              <span
                className="payments-summary__icon"
                style={{ background: item.iconBg, color: item.iconColor }}
                aria-hidden="true"
              >
                <Icon />
              </span>
              <div className="payments-summary__body">
                <p className="payments-summary__value">
                  {loading ? '—' : summary[item.summaryKey] || '₹0'}
                </p>
                <p className="payments-summary__label">{item.label}</p>
              </div>
            </article>
          );
        })}
      </div>

      <div className="payments-panel">
        <div className="payments-table-wrap">
          <table className="payments-table">
            <thead>
              <tr>
                <th>Payment ID</th>
                <th>Booking</th>
                <th>Customer</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="payments-table__empty">
                    Loading payments...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="payments-table__empty">
                    No payment transactions yet.
                  </td>
                </tr>
              ) : (
                payments.map((payment) => {
                  const statusStyle = paymentStatusStyles[payment.status] || paymentStatusStyles.Pending;

                  return (
                    <tr key={payment.paymentId}>
                      <td className="payments-table__id">{payment.id}</td>
                      <td className="payments-table__booking">{payment.bookingId}</td>
                      <td>
                        <div className="payments-customer">
                          <span
                            className="payments-customer__avatar"
                            style={{ background: payment.customer.color }}
                            aria-hidden="true"
                          >
                            {payment.customer.initials}
                          </span>
                          <span className="payments-customer__name">{payment.customer.name}</span>
                        </div>
                      </td>
                      <td className="payments-table__method">{payment.method}</td>
                      <td className="payments-table__amount">{formatAmount(payment.amount)}</td>
                      <td>
                        <span
                          className="payments-status"
                          style={{ background: statusStyle.bg, color: statusStyle.color }}
                        >
                          {payment.status}
                        </span>
                      </td>
                      <td className="payments-table__date">{payment.date}</td>
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

export default Payments;
