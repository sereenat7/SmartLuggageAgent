import api from './api';

export async function fetchUsers() {
  const { data } = await api.get('/users');
  return data.users || [];
}
