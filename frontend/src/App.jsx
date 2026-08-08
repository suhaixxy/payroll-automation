import { Navigate, Route, Routes } from "react-router-dom";

import AppLayout from "./components/AppLayout";
import { AuthProvider, useAuth } from "./context/AuthContext";

import ApprovalPage from "./pages/ApprovalPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import PaymentBatchDetailsPage from "./pages/PaymentBatchDetailsPage";
import PaymentBatchesPage from "./pages/PaymentBatchesPage";
import PaymentPreviewPage from "./pages/PaymentPreviewPage";
import PayPeriodsPage from "./pages/PayPeriodsPage";
import PayrollCalcPage from "./pages/PayrollCalcPage";
import PayslipDetailsPage from "./pages/PayslipDetailsPage";
import PayslipsPage from "./pages/PayslipsPage";
import ProfilePage from "./pages/ProfilePage";
import ReviewEmployeesPage from "./pages/ReviewEmployeesPage";
import RosterSyncPage from "./pages/RosterSyncPage";
import StaffPage from "./pages/StaffPage";
import TimesheetValidationPage from "./pages/TimesheetValidationPage";

import ProtectedRoute from "./routes/ProtectedRoute";
import RoleRoute from "./routes/RoleRoute";

function RoleLanding() {
  const { user } = useAuth();

  return (
    <Navigate
      to={user?.role === "manager" ? "/dashboard" : "/payslips"}
      replace
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Authenticated routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<RoleLanding />} />

            {/* Shared authenticated routes */}
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/payslips" element={<PayslipsPage />} />
            <Route
              path="/payslips/:payslipId"
              element={<PayslipDetailsPage />}
            />

            {/* Manager-only routes */}
            <Route element={<RoleRoute allowedRoles={["manager"]} />}>
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* UC-001 */}
              <Route path="/roster" element={<RosterSyncPage />} />
              <Route path="/staff" element={<StaffPage />} />
              <Route path="/pay-periods" element={<PayPeriodsPage />} />

              {/* UC-002 */}
              <Route
                path="/timesheets"
                element={<TimesheetValidationPage />}
              />

              {/* UC-003 */}
              <Route path="/payroll" element={<PayrollCalcPage />} />

              {/* UC-004 */}
              <Route path="/approvals" element={<ApprovalPage />} />

              {/* UC-005 */}
              <Route
                path="/payments/preview"
                element={<PaymentPreviewPage />}
              />
              <Route
                path="/payments/review-employees"
                element={<ReviewEmployeesPage />}
              />
              <Route path="/payments" element={<PaymentBatchesPage />} />
              <Route
                path="/payments/:batchId"
                element={<PaymentBatchDetailsPage />}
              />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
