import api from './api';

export async function fetchReviews() {
  const { data } = await api.get('/reviews');
  if (!data?.success) {
    throw new Error(data?.message || 'Failed to load reviews');
  }
  return data.reviews || [];
}
