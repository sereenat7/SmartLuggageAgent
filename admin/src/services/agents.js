import api from './api';

export async function fetchAgents() {
  const { data } = await api.get('/admin/agents');
  return data.agents || [];
}

export async function fetchAgentProfile(agentId) {
  const { data } = await api.get(`/admin/agents/${agentId}/profile`);
  return data;
}
