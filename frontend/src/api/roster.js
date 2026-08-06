// UC-001: API wrapper functions for roster sync, built on top of the
// shared apiGet/apiPost helpers in api/client.js.

import { apiGet, apiPost } from "./client";

function fetchPayPeriods() {
  return apiGet("/api/pay-periods");
}

function fetchSyncSummary(payPeriodId) {
  return apiGet(`/api/roster/sync/summary?payPeriodId=${payPeriodId}`);
}

function fetchSyncHistory(payPeriodId) {
  return apiGet(`/api/roster/sync/history?payPeriodId=${payPeriodId}`);
}

function triggerImportNow(payPeriodId) {
  return apiPost("/api/roster/sync", { payPeriodId }, { allowStatuses: [424] });
}

function simulateSheetDown(payPeriodId) {
  return apiPost("/api/roster/sync", { payPeriodId, simulateFailure: true }, { allowStatuses: [424] });
}

export { fetchPayPeriods, fetchSyncSummary, fetchSyncHistory, triggerImportNow, simulateSheetDown };
