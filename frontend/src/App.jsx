import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import RosterSyncPage from "./pages/RosterSyncPage";
import TimesheetValidationPage from "./pages/TimesheetValidationPage";
import PayrollCalcPage from "./pages/PayrollCalcPage";
import ApprovalPage from "./pages/ApprovalPage";
import PaymentPage from "./pages/PaymentPage";

function App() {
  return (
    <BrowserRouter>
      <nav style={{ padding: "1rem", borderBottom: "1px solid #ccc" }}>
        <Link to="/roster" style={{ marginRight: "1rem" }}>UC-001 Roster</Link>
        <Link to="/timesheets" style={{ marginRight: "1rem" }}>UC-002 Timesheets</Link>
        <Link to="/payroll" style={{ marginRight: "1rem" }}>UC-003 Payroll</Link>
        <Link to="/approvals" style={{ marginRight: "1rem" }}>UC-004 Approvals</Link>
        <Link to="/payments">UC-005 Payments</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to="/approvals" replace />} />
        <Route path="/roster" element={<RosterSyncPage />} />
        <Route path="/timesheets" element={<TimesheetValidationPage />} />
        <Route path="/payroll" element={<PayrollCalcPage />} />
        <Route path="/approvals" element={<ApprovalPage />} />
        <Route path="/payments" element={<PaymentPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;