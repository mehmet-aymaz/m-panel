const BASE_URL = '/api';

export const getAuthToken = () => localStorage.getItem('token');
export const setAuthToken = (token) => localStorage.setItem('token', token);
export const removeAuthToken = () => localStorage.removeItem('token');

export const logout = () => {
  removeAuthToken();
  // Redirect to login if not already there
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
};

async function apiFetch(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    logout();
    throw new Error('Oturum süresi doldu. Lütfen tekrar giriş yapın.');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || 'Bir hata oluştu.');
  }

  return data;
}

export const api = {
  login: async (username, password) => {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (data.access_token) {
      setAuthToken(data.access_token);
    }
    return data;
  },
  
  getSystemStatus: () => apiFetch('/system/status'),
  
  getDashboardSummary: () => apiFetch('/dashboard/summary'),
  
  // Inbounds CRUD
  getInbounds: () => apiFetch('/inbounds/'),
  createInbound: (data) => apiFetch('/inbounds/', { method: 'POST', body: JSON.stringify(data) }),
  updateInbound: (id, data) => apiFetch(`/inbounds/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteInbound: (id) => apiFetch(`/inbounds/${id}`, { method: 'DELETE' }),
  toggleInbound: (id) => apiFetch(`/inbounds/${id}/toggle`, { method: 'PATCH' }),
  
  // Clients CRUD
  getClients: () => apiFetch('/clients/'),
  createClient: (data) => apiFetch('/clients/', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id, data) => apiFetch(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteClient: (id) => apiFetch(`/clients/${id}`, { method: 'DELETE' }),
  toggleClient: (id) => apiFetch(`/clients/${id}/toggle`, { method: 'PATCH' }),
  resetClientTraffic: (id) => apiFetch(`/clients/${id}/reset-traffic`, { method: 'POST' }),
  getClientIpLogs: (id) => apiFetch(`/clients/${id}/ip-logs`),
  controlXray: (action) => apiFetch(`/system/xray/control?action=${action}`, { method: 'POST' }),
  getXrayLogs: () => apiFetch('/system/logs'),
  getAPITokens: () => apiFetch('/auth/api-tokens'),
  createAPIToken: (data) => apiFetch('/auth/api-tokens', { method: 'POST', body: JSON.stringify(data) }),
  deleteAPIToken: (id) => apiFetch(`/auth/api-tokens/${id}`, { method: 'DELETE' }),
  
  // Settings & 2FA
  getSettings: () => apiFetch('/settings/'),
  updateSettings: (data) => apiFetch('/settings/', { method: 'PUT', body: JSON.stringify(data) }),
  changePassword: (data) => apiFetch('/settings/change-password', { method: 'POST', body: JSON.stringify(data) }),
  setup2FA: () => apiFetch('/settings/2fa/setup', { method: 'POST' }),
  enable2FA: (code) => apiFetch('/settings/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) }),
  disable2FA: (code) => apiFetch('/settings/2fa/disable', { method: 'POST', body: JSON.stringify({ code }) }),
  testTelegram: () => apiFetch('/settings/telegram/test', { method: 'POST' }),
  verifyLogin2FA: async (temp_token, code) => {
    const data = await apiFetch('/auth/login/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ temp_token, code }),
    });
    if (data.access_token) {
      setAuthToken(data.access_token);
    }
    return data;
  },
  downloadBackup: async () => {
    const token = getAuthToken();
    const response = await fetch('/api/settings/backup', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) throw new Error('Yedek oluşturulamadı.');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'm-panel-backup.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
  },
  
  checkUpdate: () => apiFetch('/update/check'),
  getUpdateChangelog: () => apiFetch('/update/changelog'),
  applyUpdate: (version) => apiFetch('/update/apply', { method: 'POST', body: JSON.stringify({ version }) }),
  getUpdateStatus: () => apiFetch('/update/status'),
  
  // Nodes API
  getNodes: () => apiFetch('/nodes/'),
  createNode: (data) => apiFetch('/nodes/', { method: 'POST', body: JSON.stringify(data) }),
  updateNode: (id, data) => apiFetch(`/nodes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteNode: (id) => apiFetch(`/nodes/${id}`, { method: 'DELETE' }),
  testNode: (id) => apiFetch(`/nodes/${id}/test`, { method: 'POST' }),
  getNodeStats: (id) => apiFetch(`/nodes/${id}/stats`),
  syncNode: (id) => apiFetch(`/nodes/${id}/sync`, { method: 'POST' })
};

