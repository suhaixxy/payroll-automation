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

function resolveException(timesheetRowId, resolution) {
  return apiPost(`/api/roster/exceptions/${timesheetRowId}/resolve`, resolution);
}

function fetchResolvedExceptions(payPeriodId) {
  return apiGet(`/api/roster/exceptions/resolved?payPeriodId=${payPeriodId}`);
}

function undoException(timesheetRowId) {
  return apiPost(`/api/roster/exceptions/${timesheetRowId}/undo`, {});
}

function resetPeriodResolutions(payPeriodId) {
  return apiPost("/api/roster/exceptions/reset", { payPeriodId });
}

export { fetchPayPeriods, fetchSyncSummary, fetchSyncHistory, triggerImportNow, simulateSheetDown, resolveException, fetchResolvedExceptions, undoException, resetPeriodResolutions };
