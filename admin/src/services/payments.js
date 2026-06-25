import api from './api';

export async function fetchPayments() {
  const { data } = await api.get('/admin/payments');
  return {
    payments: data.payments || [],
    summary: data.summary || null,
  };
}
