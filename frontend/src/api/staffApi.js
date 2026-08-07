import apiClient from "./client";

export const updateBankDetails = async (staffId, values) => (await apiClient.patch(`/staff/${staffId}/bank-details`, values)).data;
