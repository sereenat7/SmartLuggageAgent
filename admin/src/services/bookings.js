import api from './api';

export async function fetchBookings() {
  const { data } = await api.get('/admin/bookings');
  return data.bookings || [];
}

export async function fetchBookingCount() {
  const { data } = await api.get('/admin/bookings/count');
  return data.count ?? 0;
}
