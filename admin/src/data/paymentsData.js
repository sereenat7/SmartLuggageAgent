export const paymentStatusStyles = {
  Success: { bg: '#dcfce7', color: '#15803d' },
  Pending: { bg: '#fef3c7', color: '#b45309' },
  Refunded: { bg: '#e0e7ff', color: '#4338ca' },
  Failed: { bg: '#fee2e2', color: '#b91c1c' },
};

export const summaryCardConfig = [
  {
    id: 'collected',
    label: 'Total Collected',
    summaryKey: 'collected',
    icon: 'card',
    iconBg: '#ffedd5',
    iconColor: '#f97316',
  },
  {
    id: 'pending',
    label: 'Pending',
    summaryKey: 'pending',
    icon: 'clock',
    iconBg: '#fef3c7',
    iconColor: '#d97706',
  },
  {
    id: 'refunded',
    label: 'Refunded',
    summaryKey: 'refunded',
    icon: 'refund',
    iconBg: '#dbeafe',
    iconColor: '#2563eb',
  },
  {
    id: 'failed',
    label: 'Failed',
    summaryKey: 'failed',
    icon: 'failed',
    iconBg: '#fee2e2',
    iconColor: '#ef4444',
  },
];
