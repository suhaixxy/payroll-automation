import { getAccessToken } from "./client";

const BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

async function request(path, options = {}) {
  const token = getAccessToken();
  const response = await fetch(`${BASE_URL}/api/staff${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || `Staff API request failed: ${response.status}`);
  }

  return payload;
}

const getStaff = (status) => request(status ? `?status=${encodeURIComponent(status)}` : "");
const createStaff = (staff) => request("", { method: "POST", body: JSON.stringify(staff) });
const updateStaff = (id, staff) => request(`/${id}`, { method: "PATCH", body: JSON.stringify(staff) });
const deactivateStaff = (id) => request(`/${id}`, { method: "DELETE" });

export { getStaff, createStaff, updateStaff, deactivateStaff };
