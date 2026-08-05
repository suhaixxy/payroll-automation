import { useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import "./App.css";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import RosterSyncPage from "./pages/RosterSyncPage";
import TimesheetValidationPage from "./pages/TimesheetValidationPage";
import PayrollCalcPage from "./pages/PayrollCalcPage";
import ApprovalPage from "./pages/ApprovalPage";
import PaymentPage from "./pages/PaymentPage";
import { IconGrid, IconUsers, IconClock, IconCalculator, IconClipboardCheck, IconCreditCard, IconLogout, IconMenu } from "./components/icons";

const navItems = [
  { to: "/", end: true, label: "Dashboard", icon: IconGrid },
  { to: "/roster", label: "Roster", icon: IconUsers },
  { to: "/timesheets", label: "Timesheets", icon: IconClock },
  { to: "/payroll", label: "Payroll", icon: IconCalculator },
  { to: "/approvals", label: "Approvals", icon: IconClipboardCheck },
  { to: "/payments", label: "Payments", icon: IconCreditCard },
];

const pageTitles = {
  "/": "Dashboard",
  "/roster": "Roster Sync",
  "/timesheets": "Timesheet Validation",
  "/payroll": "Payroll Calculation",
  "/approvals": "Approvals",
  "/payments": "Payments",
};

function AppShell() {
  const location = useLocation();
  const [navExpanded, setNavExpanded] = useState(() => window.innerWidth > 900);
  const title = pageTitles[location.pathname] || "Payroll Automation";

  return (
    <div className="app-shell">
      <aside className={`app-sidebar ${navExpanded ? "expanded" : "collapsed"}`}>
        <div className="sidebar-brand">
          <span className="brand-mark">EF</span>
          <div><strong>EFAR</strong><small>Payroll Automation System</small></div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(({ to, end, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={end} onClick={() => window.innerWidth <= 900 && setNavExpanded(false)} className={({ isActive }) => (isActive ? "active" : "")}>
              <Icon /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <NavLink to="/login"><IconLogout /><span>Sign out</span></NavLink>
        </div>
      </aside>
      <div className={`sidebar-scrim ${navExpanded ? "visible" : ""}`} onClick={() => setNavExpanded(false)} />
      <div className="app-body">
        <header className="app-topbar">
          <button className="icon-button" onClick={() => setNavExpanded((value) => !value)} aria-label="Toggle navigation"><IconMenu /></button>
          <h1>{title}</h1>
          <div className="topbar-user">
            <span className="topbar-avatar">PM</span>
            <div><strong>Payroll Manager</strong><small>Manager</small></div>
          </div>
        </header>
        <main className="app-content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/roster" element={<RosterSyncPage />} />
            <Route path="/timesheets" element={<TimesheetValidationPage />} />
            <Route path="/payroll" element={<PayrollCalcPage />} />
            <Route path="/approvals" element={<ApprovalPage />} />
            <Route path="/payments" element={<PaymentPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<AppShell />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
