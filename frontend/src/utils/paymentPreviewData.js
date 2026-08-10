const initials = (name = "") => name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "—";

const missingReason = (fields = []) => {
  if (fields.includes("bankCode") && fields.includes("bankAccountNumber")) return "No bank account information provided.";
  if (fields.includes("bankCode")) return "Bank code is missing.";
  return "Bank account number is missing.";
};

const normalizeRealEmployee = (employee) => {
  const suppliedStatus = employee.bankValidationStatus;
  const status = ["ready", "missing", "invalid"].includes(suppliedStatus)
    ? suppliedStatus
    : (!employee.bankCode || !employee.bankAccountNumber ? "missing" : "ready");
  return {
    ...employee,
    grossPay: Number(employee.grossPay || 0),
    cpfAmount: Number(employee.cpfAmount || 0),
    sdlAmount: Number(employee.sdlAmount || 0),
    approvedNetPay: Number(employee.approvedNetPay || 0),
    status,
    issueReason: employee.bankValidationReason || (status === "missing" ? missingReason(employee.missingFields) : ""),
    initials: initials(employee.employeeName),
  };
};

const normalizeLegacyMissingEmployee = (employee) => ({
  ...employee,
  grossPay: Number(employee.grossPay || 0),
  cpfAmount: Number(employee.cpfAmount || 0),
  sdlAmount: Number(employee.sdlAmount || 0),
  approvedNetPay: Number(employee.approvedNetPay || 0),
  bankCode: "",
  bankAccountNumber: "",
  status: "missing",
  issueReason: missingReason(employee.missingFields),
  initials: initials(employee.employeeName),
});

export const buildPaymentPreviewRows = ({ preview, missingDetails = [] }) => {
  if (Array.isArray(preview?.employees)) return preview.employees.map(normalizeRealEmployee);
  if (missingDetails.length) return missingDetails.map(normalizeLegacyMissingEmployee);
  return [];
};

export const getPreviewCounts = (rows) => {
  const missing = rows.filter((employee) => employee.status === "missing");
  const invalid = rows.filter((employee) => employee.status === "invalid");
  const ready = rows.filter((employee) => employee.status === "ready");
  return { missing, invalid, ready, excludedCount: missing.length + invalid.length };
};

export const matchesEmployeeSearch = (employee, search) => {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return [employee.employeeName, employee.employeeReference].some((value) => String(value || "").toLowerCase().includes(query));
};
