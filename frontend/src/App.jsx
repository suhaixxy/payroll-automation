import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import RosterSyncPage from "./pages/RosterSyncPage";
import TimesheetValidationPage from "./pages/TimesheetValidationPage";
import PayrollCalcPage from "./pages/PayrollCalcPage";
import ApprovalPage from "./pages/ApprovalPage";
import PaymentPage from "./pages/PaymentPage";

function App() {
  return (
    <BrowserRouter>
      <nav style={{ padding: "1rem", borderBottom: "1px solid #ccc" }}>
        {/* Domain language, not use-case numbers (guide §7.8) — staff who
            use this every day think "payroll", not "UC-003". */}
        <Link to="/" style={{ marginRight: "1rem" }}>Dashboard</Link>
        <Link to="/roster" style={{ marginRight: "1rem" }}>Roster</Link>
        <Link to="/timesheets" style={{ marginRight: "1rem" }}>Timesheets</Link>
        <Link to="/payroll" style={{ marginRight: "1rem" }}>Payroll Calculation</Link>
        <Link to="/approvals" style={{ marginRight: "1rem" }}>Approvals</Link>
        <Link to="/payments">Payments</Link>
      </nav>

      <Routes>
        <Route path="/" element={<DashboardPage />} />
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