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
  
  getInbounds: () => apiFetch('/inbounds/'),
  
  getClients: () => apiFetch('/clients/'),
};
