import AsyncStorage from '@react-native-async-storage/async-storage';
import { AGENTS_API_URL } from './api';

async function getAuthTokenOrThrow() {
  const token = await AsyncStorage.getItem('authToken');
  if (!token) throw new Error('Not authenticated');
  return token;
}

async function apiRequest(path, method = 'GET', body) {
  const token = await getAuthTokenOrThrow();

  const response = await fetch(`${AGENTS_API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  const rawText = await response.text();
  const data = contentType.includes('application/json') && rawText
    ? JSON.parse(rawText)
    : { message: rawText };
  if (!response.ok || data.success === false) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

export async function requestAgent(preferredAgentId = null) {
  const body = preferredAgentId ? { preferredAgentId } : undefined;
  return apiRequest('/request-agent', 'POST', body);
}

export async function getNearbyAgentRecommendations(payload = {}) {
  return apiRequest('/recommend-nearby', 'POST', payload);
}

export async function assignBestAgent(payload = {}) {
  return apiRequest('/assign-best-agent', 'POST', payload);
}

export async function getAssignmentStatus() {
  return apiRequest('/assignment-status', 'GET');
}

export async function completeAgentSession() {
  return apiRequest('/complete-session', 'POST');
}