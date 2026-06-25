import api from './api';

export async function fetchComplaints() {
  const { data } = await api.get('/complaints');
  return data.complaints || [];
}

export async function fetchComplaintCount() {
  const { data } = await api.get('/complaints/count');
  return data.count ?? 0;
}

export async function sendComplaintReply(id, message) {
  const { data } = await api.post(`/complaints/${id}/reply`, { message });
  return data;
}
