// Small helper functions for talking to the roster sync backend (UC-001).

const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

async function apiGet(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`API GET ${path} failed: ${response.status}`);
  }
  return response.json();
}

async function apiPost(path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`API POST ${path} failed: ${response.status}`);
  }
  return response.json();
}

// ── Auth + payroll helpers (UC-003) ────────────────────────────────────
// The payroll endpoints require a login, so these helpers attach the JWT
// from localStorage as a Bearer token, and return { ok, status, data } so
// pages can branch on 401/404/409 instead of only seeing parsed JSON.

const TOKEN_KEY = 'accessToken';

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeAccessToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function authedFetch(path, options = {}) {
  const token = getAccessToken();
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data };
}

export function registerUser(body) {
  return authedFetch('/api/user/register', { method: 'POST', body: JSON.stringify(body) });
}

export function loginUser(body) {
  return authedFetch('/api/user/login', { method: 'POST', body: JSON.stringify(body) });
}

export function fetchCurrentUser() {
  return authedFetch('/api/user/auth');
}

// UC-003 (guide §6): the /api/uc003 calculation surface. Responses use the
// standard { success, data, meta } envelope — callers read body.data.
export function fetchPayrollPeriods() {
  return authedFetch('/api/uc003/periods');
}

export function calculatePayroll(periodId) {
  return authedFetch(`/api/uc003/periods/${encodeURIComponent(periodId)}/calculate`, {
    method: 'POST',
  });
}

export function recalculatePayroll(periodId) {
  return authedFetch(`/api/uc003/periods/${encodeURIComponent(periodId)}/recalculate`, {
    method: 'POST',
  });
}

export function submitForApproval(periodId) {
  return authedFetch(`/api/uc003/periods/${encodeURIComponent(periodId)}/submit-approval`, {
    method: 'POST',
  });
}

export function fetchPayrollSummary(periodId) {
  return authedFetch(`/api/uc003/periods/${encodeURIComponent(periodId)}/summary`);
}

export function fetchPayrollLines(periodId, query = 'limit=100') {
  return authedFetch(`/api/uc003/periods/${encodeURIComponent(periodId)}/lines?${query}`);
}

export function fetchRunHistory(periodId) {
  return authedFetch(`/api/uc003/periods/${encodeURIComponent(periodId)}/runs`);
}

// Staff options for the adjustment / performance-input forms (read-only).
export function fetchUc003Staff() {
  return authedFetch('/api/uc003/staff');
}

// Payroll adjustments — full CRUD (manager-only mutations, enforced
// server-side; the UI only hides buttons).
export function fetchAdjustments(periodId) {
  return authedFetch(`/api/uc003/adjustments?periodId=${encodeURIComponent(periodId)}`);
}

export function createAdjustment(body) {
  return authedFetch('/api/uc003/adjustments', { method: 'POST', body: JSON.stringify(body) });
}

export function updateAdjustment(id, body) {
  return authedFetch(`/api/uc003/adjustments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteAdjustment(id) {
  return authedFetch(`/api/uc003/adjustments/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// Performance inputs — full CRUD (manager-only mutations, enforced
// server-side). Saving one is how an incomplete MISSING_PERFORMANCE_INPUT
// line gets resolved (guide §5.8).
export function fetchPerformanceInputs(periodId) {
  return authedFetch(`/api/uc003/performance-inputs?periodId=${encodeURIComponent(periodId)}`);
}

export function createPerformanceInput(body) {
  return authedFetch('/api/uc003/performance-inputs', { method: 'POST', body: JSON.stringify(body) });
}

export function updatePerformanceInput(id, body) {
  return authedFetch(`/api/uc003/performance-inputs/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deletePerformanceInput(id) {
  return authedFetch(`/api/uc003/performance-inputs/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export { apiGet, apiPost };