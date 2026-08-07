import apiClient from "./client";

export const login = async (credentials) =>
  (await apiClient.post("/auth/login", credentials)).data;

export const getCurrentUser = async () =>
  (await apiClient.get("/auth/me")).data;

export const logout = async () =>
  (await apiClient.post("/auth/logout")).data;