const API_ROOT = (process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.127:5000').replace(/\/+$/, '');
export const COMPLAINTS_API_URL = `${API_ROOT}/api/complaints`;

export async function submitComplaint({
  name,
  email,
  phone,
  issueType,
  customIssueType,
  message,
}) {
  const payload = {
    name: name || 'User',
    email: email || null,
    phone: phone || null,
    issueType,
    customIssueType: customIssueType || null,
    message: message.trim(),
  };

  console.log('[Complaint] POST', COMPLAINTS_API_URL, payload);

  const response = await fetch(COMPLAINTS_API_URL, {
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
    console.error('[Complaint] Invalid JSON response:', raw);
    throw new Error('Invalid response from server');
  }

  if (!response.ok || !result.success) {
    console.error('[Complaint] Submit failed:', result);
    throw new Error(result.message || `Could not submit complaint (${response.status})`);
  }

  console.log('[Complaint] Submit success:', result);
  return result;
}
