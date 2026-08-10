import apiClient from "./client";

export const getEligiblePeriods = async () => (await apiClient.get("/payments/eligible-periods")).data;
export const getPaymentPreview = async (payPeriodId) => (await apiClient.get("/payments/preview", { params: { payPeriodId } })).data;
export const generatePayment = async (payPeriodId) => (await apiClient.post("/payments/generate", { payPeriodId })).data;
export const getPaymentStatistics = async () => (await apiClient.get("/payments/dashboard/statistics")).data;
export const getPaymentBatches = async (params = {}) => (await apiClient.get("/payments", { params })).data;
export const getPaymentBatch = async (batchId) => (await apiClient.get(`/payments/${batchId}`)).data;
export const downloadPaymentFile = (batchId) => apiClient.get(`/payments/${batchId}/file`, { responseType: "blob" });
export const retryHrms = async (batchId) => (await apiClient.post(`/payments/${batchId}/retry-hrms`)).data;
export const cancelPaymentBatch = async (batchId, reason) => (await apiClient.patch(`/payments/${batchId}/cancel`, { reason })).data;
export const getBatchPayslips = async (batchId) => (await apiClient.get(`/payments/${batchId}/payslips`)).data;
