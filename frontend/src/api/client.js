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

// UC-003: periods WITH status (the plain /api/pay-periods list has no
// status, and the payroll page needs to know which ones are 'validated').
export function fetchPayrollPeriods() {
  return authedFetch('/api/payroll/periods/list');
}

export function calculatePayroll(payPeriodId) {
  return authedFetch('/api/payroll/calculate', {
    method: 'POST',
    body: JSON.stringify({ payPeriodId }),
  });
}

export function fetchPayrollForPeriod(payPeriodId) {
  return authedFetch(`/api/payroll/${encodeURIComponent(payPeriodId)}`);
}

export { apiGet, apiPost };