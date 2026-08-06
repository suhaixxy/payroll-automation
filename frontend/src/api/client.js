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

async function apiPost(path, body) {
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

  if (!response.ok) {
    throw new Error(`API POST ${path} failed: ${response.status}`);
  }

  return response.json();
}

export {
  TOKEN_KEY,
  apiGet,
  apiPost,
};

export default apiClient;
