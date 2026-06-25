import api from './api';
import { setAuthSession } from './storage';

export async function loginAdmin(email, password) {
  const { data } = await api.post('/admin/login', { email, password });

  if (data?.success && data.token && data.admin) {
    setAuthSession(data.token, data.admin);
  }

  return data;
}

export async function changePassword(currentPassword, newPassword) {
  const { data } = await api.post('/admin/change-password', {
    currentPassword,
    newPassword,
  });
  return data;
}
