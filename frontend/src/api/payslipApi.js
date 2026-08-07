import apiClient from "./client";

export const getMyPayslips = async () => (await apiClient.get("/payslips/me")).data;
export const getPayslips = async () => (await apiClient.get("/payslips")).data;
export const getPayslip = async (payslipId) => (await apiClient.get(`/payslips/${payslipId}`)).data;
export const downloadPayslipPdf = (payslipId) => apiClient.get(`/payslips/${payslipId}/pdf`, { responseType: "blob" });
