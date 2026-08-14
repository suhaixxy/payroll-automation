import axios from "axios";

const BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

const TOKEN_KEY = "payrollAccessToken";

const API_URL = `${BASE_URL.replace(/\/$/, "")}/api`;

// ==========================================================
// Axios client
// Used by UC-005 authentication, payment, payslip and staff APIs
// ==========================================================

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    Accept: "application/json",
  },
});

export const getAccessToken = () => localStorage.getItem(TOKEN_KEY);

export const setAccessToken = (token) => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const clearAccessToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && getAccessToken()) {
      clearAccessToken();
      window.dispatchEvent(new Event("payroll:unauthorized"));
    }

    return Promise.reject(error);
  }
);

// ==========================================================
// Fetch helpers
// Preserved for existing/shared group frontend code
// ==========================================================

async function apiGet(path) {
  const headers = {};
  const token = getAccessToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    headers,
  });

  if (!response.ok) {
    throw new Error(`API GET ${path} failed: ${response.status}`);
  }

  return response.json();
}

async function apiPost(path, body, { allowStatuses = [] } = {}) {
  const headers = {
    "Content-Type": "application/json",
  };

  const token = getAccessToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const payload = await response.json();

  if (!response.ok && !allowStatuses.includes(response.status)) {
    throw new Error(payload?.error?.message || payload?.message || `API POST ${path} failed: ${response.status}`);
  }

  return payload;
}

// ==========================================================
// UC-003 payroll helpers
// The payroll endpoints require a login, so these helpers attach the JWT
// from localStorage as a Bearer token, and return { ok, status, data } so
// pages can branch on 401/404/409 instead of only seeing parsed JSON.
// ==========================================================

async function authedFetch(path, options = {}) {
  const token = getAccessToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data };
}

// UC-003 (guide §6): the /api/uc003 calculation surface. Responses use the
// standard { success, data, meta } envelope — callers read body.data.
export function fetchPayrollPeriods() {
  return authedFetch("/api/uc003/periods");
}

export function calculatePayroll(periodId) {
  return authedFetch(`/api/uc003/periods/${encodeURIComponent(periodId)}/calculate`, {
    method: "POST",
  });
}

export function recalculatePayroll(periodId) {
  return authedFetch(`/api/uc003/periods/${encodeURIComponent(periodId)}/recalculate`, {
    method: "POST",
  });
}

export function submitForApproval(periodId) {
  return authedFetch(`/api/uc003/periods/${encodeURIComponent(periodId)}/submit-approval`, {
    method: "POST",
  });
}

export function fetchPayrollSummary(periodId) {
  return authedFetch(`/api/uc003/periods/${encodeURIComponent(periodId)}/summary`);
}

// params: { status, search, sort, dir, page, limit } — empty values are
// dropped so the URL only carries what the user actually set.
export function fetchPayrollLines(periodId, params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, value);
  }
  if (!query.has("limit")) query.set("limit", "20");
  return authedFetch(`/api/uc003/periods/${encodeURIComponent(periodId)}/lines?${query}`);
}

// Single line with its full calc_breakdown + run provenance (§7.3 modal).
export function fetchPayrollLine(lineId) {
  return authedFetch(`/api/uc003/lines/${encodeURIComponent(lineId)}`);
}

export function fetchRunHistory(periodId) {
  return authedFetch(`/api/uc003/periods/${encodeURIComponent(periodId)}/runs`);
}

export function voidCalculationRun(runId, reason) {
  return authedFetch(`/api/uc003/runs/${encodeURIComponent(runId)}/void`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

// §7.2 per-staff net-pay deltas vs the previous period's run.
export function fetchStaffVariance(periodId) {
  return authedFetch(`/api/uc003/periods/${encodeURIComponent(periodId)}/variance`);
}

// §7.9 payroll register CSV. Can't be a plain <a href> because the endpoint
// needs the Bearer token, so fetch the bytes and hand them to the browser
// as a download.
export async function downloadPayrollRegister(periodId) {
  const token = getAccessToken();
  const response = await fetch(
    `${BASE_URL}/api/uc003/periods/${encodeURIComponent(periodId)}/export.csv`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    return { ok: false, status: response.status, data };
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] || "payroll-register.csv";
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return { ok: true, status: response.status, data: null };
}

// Staff options for the adjustment / performance-input forms (read-only).
export function fetchUc003Staff() {
  return authedFetch("/api/uc003/staff");
}

// Payroll adjustments — full CRUD (manager-only mutations, enforced
// server-side; the UI only hides buttons).
export function fetchAdjustments(periodId) {
  return authedFetch(`/api/uc003/adjustments?periodId=${encodeURIComponent(periodId)}`);
}

export function createAdjustment(body) {
  return authedFetch("/api/uc003/adjustments", { method: "POST", body: JSON.stringify(body) });
}

export function updateAdjustment(id, body) {
  return authedFetch(`/api/uc003/adjustments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteAdjustment(id) {
  return authedFetch(`/api/uc003/adjustments/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// Performance inputs — full CRUD (manager-only mutations, enforced
// server-side). Saving one is how an incomplete MISSING_PERFORMANCE_INPUT
// line gets resolved (guide §5.8).
export function fetchPerformanceInputs(periodId) {
  return authedFetch(`/api/uc003/performance-inputs?periodId=${encodeURIComponent(periodId)}`);
}

export function createPerformanceInput(body) {
  return authedFetch("/api/uc003/performance-inputs", { method: "POST", body: JSON.stringify(body) });
}

export function updatePerformanceInput(id, body) {
  return authedFetch(`/api/uc003/performance-inputs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deletePerformanceInput(id) {
  return authedFetch(`/api/uc003/performance-inputs/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// Statutory rate sets — read-only in the UI; a new version supersedes the
// old one via POST (manager, no UI yet per the guide).
export function fetchRateSets() {
  return authedFetch("/api/uc003/rate-sets");
}

export function fetchRateSet(id) {
  return authedFetch(`/api/uc003/rate-sets/${encodeURIComponent(id)}`);
}

// Payroll line CRUD — manual overrides on the latest run.
export function createPayrollLine(periodId, body) {
  return authedFetch(`/api/uc003/periods/${encodeURIComponent(periodId)}/lines`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updatePayrollLine(lineId, body) {
  return authedFetch(`/api/uc003/lines/${encodeURIComponent(lineId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deletePayrollLine(lineId) {
  return authedFetch(`/api/uc003/lines/${encodeURIComponent(lineId)}`, {
    method: "DELETE",
  });
}

export function resolvePayrollLine(lineId, note) {
  return authedFetch(`/api/uc003/lines/${encodeURIComponent(lineId)}/resolve`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

// Edit history audit trail.
export function fetchEditHistory(entityType, entityId) {
  return authedFetch(`/api/uc003/edit-log/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`);
}

export function fetchRecentEdits(limit = 50) {
  return authedFetch(`/api/uc003/edit-log/recent?limit=${limit}`);
}

export { TOKEN_KEY, apiGet, apiPost };

export default apiClient;
