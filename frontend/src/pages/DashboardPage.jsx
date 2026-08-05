import { useEffect, useState } from "react";
import { apiGet } from "../api/client";
import RosterSyncPage from './RosterSyncPage.jsx';
import PayrollCalcPage from './PayrollCalcPage.jsx';

// Placeholder for any use case whose page hasn't been built yet. Once that
// use case is ready, swap its entry in TABS below for the real component —
// nothing else in this file needs to change.
function DashboardPage() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet("/health")
      .then(setHealth)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <h1>Dashboard — coming soon</h1>
      {/* TEMP: connection test, remove once real dashboard is built */}
      <p>Backend connection test:</p>
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {health && <pre>{JSON.stringify(health, null, 2)}</pre>}
      {!health && !error && <p>Loading...</p>}
    </div>
  );
}

// One entry per use case. To plug in a finished page: import the real
// component at the top of this file, then replace its `component` value here.
const TABS = [
  { key: 'roster', label: 'Roster Sync (UC-001)', component: RosterSyncPage },
  { key: 'timesheets', label: 'Timesheet Validation (UC-002)', component: () => <ComingSoon label="Timesheet Validation" /> },
  { key: 'payroll', label: 'Payroll Calculation (UC-003)', component: PayrollCalcPage },
  { key: 'approval', label: 'Approval (UC-004)', component: () => <ComingSoon label="Approval" /> },
  { key: 'payment', label: 'Payment & HRMS (UC-005)', component: () => <ComingSoon label="Payment & HRMS" /> },
];

// Shared shell for the whole app: the top bar, the tab nav switching
// between each use case's page, and whichever page is currently active.
function DashboardPage() {
  const [activeTabKey, setActiveTabKey] = useState(TABS[0].key);
  const ActivePage = TABS.find((tab) => tab.key === activeTabKey).component;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <h1>Payroll Automation</h1>
        </div>
        <div className="topbar-inner dashboard-nav">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`nav-tab${tab.key === activeTabKey ? ' nav-tab-active' : ''}`}
              onClick={() => setActiveTabKey(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <ActivePage />
    </div>
  );
}

export default DashboardPage;