import { apiGet, apiPost } from "./client";

function createBackpayReport(data) {
  return apiPost("/api/backpay-reports", data);
}

function fetchBackpayReports(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return apiGet(`/api/backpay-reports${params.toString() ? `?${params}` : ""}`);
}

function resolveBackpayReport(id) {
  return apiPost(`/api/backpay-reports/${id}/resolve`, {});
}

export { createBackpayReport, fetchBackpayReports, resolveBackpayReport };
