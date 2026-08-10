import apiClient from "./client";

export const getValidationPeriods = async () =>
  (await apiClient.get("/timesheets/periods")).data;

export const getTimesheetReview = async (payPeriodId) =>
  (await apiClient.get(`/timesheets/${payPeriodId}/review`)).data;

export const runTimesheetValidation = async (payPeriodId) =>
  (await apiClient.post(`/timesheets/${payPeriodId}/validate`)).data;

export const resolveTimesheetException = async (exceptionId, payload) =>
  (await apiClient.patch(`/timesheets/exceptions/${exceptionId}`, payload)).data;

export const bulkResolveTimesheetExceptions = async (payPeriodId, payload) =>
  (await apiClient.patch(`/timesheets/${payPeriodId}/exceptions/bulk`, payload)).data;

export const completeTimesheetValidation = async (payPeriodId) =>
  (await apiClient.post(`/timesheets/${payPeriodId}/complete`)).data;

export const getTimesheetAuditLog = async (payPeriodId) =>
  (await apiClient.get(`/timesheets/${payPeriodId}/audit-log`)).data;
