import React, { useState, useEffect } from 'react';
import {
  getAccessToken,
  clearAccessToken,
  fetchCurrentUser,
  fetchPayrollPeriods,
  calculatePayroll,
  fetchPayrollForPeriod,
} from '../api/client';
import PayrollLineTable, { formatCents } from '../components/PayrollLineTable';
import LoginPanel from '../components/LoginPanel';

// UC-003 page: accounting staff pick a validated pay period and run the
// payroll calculation on its frozen hour snapshot. Shows derived period
// totals, the per-staff lines with incomplete flags, and the variance
// warning against the previous period. Requires a login — the calculation
// endpoints are JWT-protected.
function PayrollCalcPage() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [payPeriods, setPayPeriods] = useState([]);
  const [selectedPayPeriodId, setSelectedPayPeriodId] = useState('');
  const [payroll, setPayroll] = useState(null); // GET /payroll/:id response
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [justCalculated, setJustCalculated] = useState(false);

  // Restore the session from a stored token, if there is one.
  useEffect(() => {
    if (!getAccessToken()) {
      setAuthChecked(true);
      return;
    }
    fetchCurrentUser().then((result) => {
      if (result.ok) {
        setUser(result.data.user);
      } else {
        clearAccessToken();
      }
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    loadPeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // A 401 means the token expired mid-session — drop back to the login card.
  function sessionExpired(result) {
    if (result.status === 401) {
      clearAccessToken();
      setUser(null);
      return true;
    }
    return false;
  }

  async function loadPeriods(keepSelectionId) {
    const result = await fetchPayrollPeriods();
    if (sessionExpired(result)) return;
    const periods = result.data.payPeriods || [];
    setPayPeriods(periods);

    if (keepSelectionId) return; // just refreshing statuses after a run

    // Default to the first period that's actually ready to calculate.
    const defaultPeriod = periods.find((period) => period.status === 'validated') || periods[0];
    if (defaultPeriod) {
      setSelectedPayPeriodId(defaultPeriod.id);
      loadPayroll(defaultPeriod.id);
    }
  }

  async function loadPayroll(payPeriodId) {
    setPayroll(null);
    const result = await fetchPayrollForPeriod(payPeriodId);
    if (sessionExpired(result)) return;
    // 404 just means "no lines yet" — the empty state covers that.
    if (result.ok) setPayroll(result.data);
  }

  function handlePeriodChange(event) {
    const payPeriodId = event.target.value;
    setSelectedPayPeriodId(payPeriodId);
    setErrorMessage(null);
    setJustCalculated(false);
    loadPayroll(payPeriodId);
  }

  async function handleCalculate() {
    setLoading(true);
    setErrorMessage(null);
    setJustCalculated(false);

    const result = await calculatePayroll(selectedPayPeriodId);
    if (sessionExpired(result)) return;

    if (!result.ok) {
      // 409 not-validated / 404 unknown period — show the server's message.
      setErrorMessage(result.data?.message || 'Calculation failed.');
    } else {
      setJustCalculated(true);
      await Promise.all([loadPayroll(selectedPayPeriodId), loadPeriods(selectedPayPeriodId)]);
    }
    setLoading(false);
  }

  function handleLogout() {
    clearAccessToken();
    setUser(null);
    setPayroll(null);
    setPayPeriods([]);
  }

  const selectedPeriod = payPeriods.find((period) => period.id === selectedPayPeriodId);

  if (!authChecked) {
    return (
      <div className="page">
        <p className="muted">Checking session…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <div className="page-intro">
          <h2>Payroll Calculation</h2>
          <p className="muted">
            Calculating payroll needs a logged-in account — the amounts here end up in real payments,
            so every run is tied to who triggered it.
          </p>
        </div>
        <LoginPanel onLoggedIn={setUser} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-intro">
        <h2>Payroll Calculation</h2>
        <p className="muted">
          Runs the pay calculation on a validated period's frozen hour snapshot: part-timer gross from
          hours × rate (with OT and public-holiday multipliers), full-timer incentives from performance
          inputs, and CPF/SDL computed by the system. A successful run hands the period to management
          approval (UC-004).
        </p>
        <p className="muted">
          Signed in as <strong>{user.name}</strong> ({user.role}) ·{' '}
          <button type="button" className="login-switch" onClick={handleLogout}>
            Log out
          </button>
        </p>
      </div>

      <div className="field-row">
        <label htmlFor="payroll-period-select">Pay Period</label>
        <select
          id="payroll-period-select"
          value={selectedPayPeriodId}
          onChange={handlePeriodChange}
          disabled={loading || payPeriods.length === 0}
        >
          {payPeriods.map((period) => (
            <option key={period.id} value={period.id}>
              {period.startDate} – {period.endDate} ({period.status.replace(/_/g, ' ')})
            </option>
          ))}
        </select>
      </div>

      <div className="button-row">
        <button
          className="primary"
          onClick={handleCalculate}
          disabled={loading || !selectedPayPeriodId}
        >
          {loading && <span className="spinner" />}
          {loading ? 'Calculating…' : 'Calculate Payroll'}
        </button>
        {selectedPeriod && selectedPeriod.status !== 'validated' && (
          <span className="muted button-row-caption">
            Only a period in <strong>validated</strong> status can be calculated — this one is{' '}
            {selectedPeriod.status.replace(/_/g, ' ')}.
          </span>
        )}
      </div>

      {errorMessage && (
        <div className="banner error-banner">
          <span className="banner-icon" aria-hidden="true">
            ⨯
          </span>
          <span>{errorMessage}</span>
        </div>
      )}

      {justCalculated && (
        <div className="banner success-banner">
          <span className="banner-icon" aria-hidden="true">
            ✓
          </span>
          <span>
            Payroll calculated — the period is now <strong>pending approval</strong> (UC-004).
          </span>
        </div>
      )}

      {payroll?.varianceWarning && payroll.variance && (
        <div className="banner warning-banner">
          <span className="banner-icon" aria-hidden="true">
            ⚠
          </span>
          <span>
            Variance warning: this period's gross ({formatCents(payroll.variance.currentGrossCents)})
            differs from the previous period's ({formatCents(payroll.variance.previousGrossCents)}) by
            more than {payroll.variance.thresholdPct}%. Review before approving — the run itself
            completed normally.
          </span>
        </div>
      )}

      {payroll?.incompleteCount > 0 && (
        <div className="banner warning-banner">
          <span className="banner-icon" aria-hidden="true">
            ⚠
          </span>
          <span>
            {payroll.incompleteCount} {payroll.incompleteCount === 1 ? 'line is' : 'lines are'}{' '}
            incomplete (missing pay rate or required performance input) and excluded from the period
            totals — see the notes in the table below.
          </span>
        </div>
      )}

      {payroll && (
        <div className="stat-grid">
          <div className="stat-tile">
            <p className="stat-label">Gross + Incentives</p>
            <div className="stat-value">{formatCents(payroll.totals.grossCents)}</div>
            <p className="stat-sub">complete lines only</p>
          </div>
          <div className="stat-tile">
            <p className="stat-label">Deductions</p>
            <div className="stat-value">{formatCents(payroll.totals.deductionsCents)}</div>
            <p className="stat-sub">CPF (employee) + SDL</p>
          </div>
          <div className="stat-tile">
            <p className="stat-label">Net Payable</p>
            <div className="stat-value">{formatCents(payroll.totals.netCents)}</div>
            <p className="stat-sub">what payment (UC-005) will pay out</p>
          </div>
          <div className="stat-tile">
            <p className="stat-label">Payroll Lines</p>
            <div className={`stat-value${payroll.incompleteCount > 0 ? ' stat-warning' : ''}`}>
              {payroll.lineCount}
            </div>
            <p className="stat-sub">
              {payroll.lineCount - payroll.incompleteCount} complete · {payroll.incompleteCount}{' '}
              incomplete
            </p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>Per-Staff Payroll Lines</h2>
          {payroll?.lines && (
            <span className="card-count">
              {payroll.lines.length} {payroll.lines.length === 1 ? 'staff member' : 'staff'}
            </span>
          )}
        </div>
        <PayrollLineTable lines={payroll?.lines} />
      </div>
    </div>
  );
}

export default PayrollCalcPage;
