import api from './api';

export async function fetchDashboardStats() {
  const { data } = await api.get('/admin/dashboard/stats');
  return data.stats;
}
