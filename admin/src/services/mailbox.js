import api from './api';

const API_ROOT = import.meta.env.DEV
  ? '/api'
  : (import.meta.env.VITE_API_URL || 'http://192.168.0.127:5000/api');

export function attachmentUrl(id) {
  return `${API_ROOT}/mailbox/attachments/${id}`;
}

export async function fetchMailboxMessages(folder = 'inbox') {
  const { data } = await api.get('/mailbox/messages', { params: { folder } });
  return data.messages || [];
}

export async function fetchMailboxMessage(id) {
  const { data } = await api.get(`/mailbox/messages/${id}`);
  return data.message;
}

export async function fetchMailboxUnreadCount() {
  const { data } = await api.get('/mailbox/unread-count');
  return data.count ?? 0;
}

export async function syncMailbox() {
  const { data } = await api.post('/mailbox/sync');
  return data;
}

export async function moveMailboxMessage(id, folder) {
  const { data } = await api.patch(`/mailbox/messages/${id}/folder`, { folder });
  return data;
}

export async function deleteMailboxMessage(id) {
  const { data } = await api.delete(`/mailbox/messages/${id}`);
  return data;
}

export async function sendMailboxEmail({ to, subject, message, attachments = [] }) {
  const formData = new FormData();
  formData.append('to', to);
  formData.append('subject', subject);
  formData.append('message', message);
  attachments.forEach((file) => formData.append('attachments', file));

  const { data } = await api.post('/mailbox/send', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function replyMailboxMessage(id, { message, attachments = [] }) {
  const formData = new FormData();
  formData.append('message', message);
  attachments.forEach((file) => formData.append('attachments', file));

  const { data } = await api.post(`/mailbox/messages/${id}/reply`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
