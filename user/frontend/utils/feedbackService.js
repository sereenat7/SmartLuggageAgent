const API_ROOT = (process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.127:5000').replace(/\/+$/, '');
export const REVIEWS_API_URL = `${API_ROOT}/api/reviews`;

export async function submitFeedback({ name, phone, category, rating, message }) {
  const payload = {
    name: name || 'User',
    phone: phone || null,
    category: category || null,
    rating,
    message: message.trim(),
  };

  console.log('[Feedback] POST', REVIEWS_API_URL, payload);

  const response = await fetch(REVIEWS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  let result = {};

  try {
    result = raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.error('[Feedback] Invalid JSON response:', raw);
    throw new Error('Invalid response from server');
  }

  if (!response.ok || !result.success) {
    console.error('[Feedback] Submit failed:', result);
    throw new Error(result.message || `Could not submit feedback (${response.status})`);
  }

  console.log('[Feedback] Submit success:', result);
  return result;
}
