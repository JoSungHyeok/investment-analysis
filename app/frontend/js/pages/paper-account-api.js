const TOKEN_KEY = 'investment_analysis_auth_token';

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.detail || '서버 모의계좌 요청에 실패했습니다.');
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function hasPaperLogin() {
  return Boolean(localStorage.getItem(TOKEN_KEY));
}

export function fetchPaperQuotes() {
  return request('/api/auth/paper/quotes');
}

export function fetchPaperAccount() {
  return request('/api/auth/paper/account');
}

export function submitPaperOrder({ symbol, side, quantity, price }) {
  return request('/api/auth/paper/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, side, quantity, price }),
  });
}

export function resetPaperAccount() {
  return request('/api/auth/paper/reset', { method: 'POST' });
}
