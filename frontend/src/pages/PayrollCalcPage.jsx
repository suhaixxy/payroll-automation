import React, { useState, useEffect } from 'react';
import {
  getAccessToken,
  clearAccessToken,
  fetchCurrentUser,
  fetchPayrollPeriods,
  calculatePayroll,
  recalculatePayroll,
  submitForApproval,
  fetchPayrollSummary,
  fetchPayrollLines,
} from '../api/client';
import PayrollLineTable, { formatMoney } from '../components/PayrollLineTable';
import AdjustmentsPanel from '../components/AdjustmentsPanel';
import PerformanceInputsPanel from '../components/PerformanceInputsPanel';
import RateSetsPanel from '../components/RateSetsPanel';
import LoginPanel from '../components/LoginPanel';
// Shared status contract (UC-003 guide §5.1) — same file the backend uses.
import payrollStatus from '../../../shared/payrollStatus.json';

const PAYROLL_STATUS = payrollStatus.statuses;

// UC-003 page: pick a validated pay period and run the payroll calculation
// on its frozen hour snapshot. Every execution is a numbered, immutable
// calculation RUN pinned to a statutory rate set; recalculating creates the
// next run instead of overwriting. A manager then submits the calculated
// period to approval (UC-004). Requires a login — every run is tied to who
// triggered it.
function PayrollCalcPage() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [payPeriods, setPayPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [summary, setSummary] = useState(null); // { period, run, variance... }
  const [lines, setLines] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('lines'); // 'lines' | 'adjustments' | 'inputs'
  const [dataChangedSinceRun, setDataChangedSinceRun] = useState(false);
  // §5.8 resolve loop: which staff member's missing input we're fixing.
  const [resolveStaffId, setResolveStaffId] = useState(null);

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
    const periods = result.data?.data?.periods || [];
    setPayPeriods(periods);

    if (keepSelectionId) return; // just refreshing statuses after a run

    // Default to the first period that's actually ready to calculate.
    const defaultPeriod =
      periods.find((period) => period.status === PAYROLL_STATUS.VALIDATED) || periods[0];
    if (defaultPeriod) {
      setSelectedPeriodId(defaultPeriod.id);
      loadPayroll(defaultPeriod.id);
    }
  }

  async function loadPayroll(periodId) {
    setSummary(null);
    setLines(null);
    const [summaryResult, linesResult] = await Promise.all([
      fetchPayrollSummary(periodId),
      fetchPayrollLines(periodId),
    ]);
    if (sessionExpired(summaryResult)) return;
    if (summaryResult.ok) setSummary(summaryResult.data.data);
    if (linesResult.ok) setLines(linesResult.data.data.lines || []);
  }

  function handlePeriodChange(event) {
    const periodId = event.target.value;
    setSelectedPeriodId(periodId);
    setErrorMessage(null);
    setSuccessMessage(null);
    loadPayroll(periodId);
  }

  // Shared wrapper for calculate / recalculate / submit: run the action,
  // surface the server's message on failure, refresh everything on success.
  async function runAction(action, buildSuccessMessage) {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const result = await action(selectedPeriodId);
    if (sessionExpired(result)) return;

    if (!result.ok) {
      setErrorMessage(result.data?.error?.message || result.data?.message || 'Action failed.');
    } else {
      setSuccessMessage(buildSuccessMessage(result.data.data));
      setDataChangedSinceRun(false);
      await Promise.all([loadPayroll(selectedPeriodId), loadPeriods(selectedPeriodId)]);
    }
    setLoading(false);
  }

  const handleCalculate = () =>
    runAction(
      calculatePayroll,
      (data) =>
        `Run #${data.run.runNumber} complete (rate set ${data.run.rateSetVersion}) — the period is now calculated. Submit it for approval when the lines look right.`
    );

  const handleRecalculate = () =>
    runAction(
      recalculatePayroll,
      (data) =>
        `Recalculated as run #${data.run.runNumber} — previous runs are kept for the audit trail.`
    );

  const handleSubmit = () =>
    runAction(
      submitForApproval,
      () => 'Submitted — the period is now pending approval (UC-004).'
    );

  // §5.8: Resolve on an incomplete line jumps to the Performance Inputs tab
  // with the create form pre-filled for that staff member.
  function handleResolve(line) {
    setResolveStaffId(line.staffId);
    setActiveTab('inputs');
  }

  // After the resolving input is saved: recalculate so the line turns
  // complete, then land back on the lines tab showing the result.
  async function handleResolvedSaved() {
    if (!resolveStaffId) {
      setDataChangedSinceRun(true);
      return;
    }
    setResolveStaffId(null);
    setActiveTab('lines');
    await runAction(
      periodStatus === PAYROLL_STATUS.VALIDATED ? calculatePayroll : recalculatePayroll,
      (data) => `Input saved and recalculated as run #${data.run.runNumber} — check the line below.`
    );
  }

  function handleLogout() {
    clearAccessToken();
    setUser(null);
    setSummary(null);
    setLines(null);
    setPayPeriods([]);
  }

  const selectedPeriod = payPeriods.find((period) => period.id === selectedPeriodId);
  const periodStatus = selectedPeriod?.status;
  const run = summary?.run;

  const canCalculate = periodStatus === PAYROLL_STATUS.VALIDATED;
  const canRecalculate =
    periodStatus === PAYROLL_STATUS.CALCULATED || periodStatus === PAYROLL_STATUS.PENDING_APPROVAL;
  const canSubmit = periodStatus === PAYROLL_STATUS.CALCULATED && user?.role === 'manager';

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
          hours × rate (OT and public-holiday multipliers from the statutory rate set), full-timer
          incentives from performance inputs, CPF by age band, and employer-borne SDL. Each execution
          is an immutable numbered run; a manager submits the calculated period to approval (UC-004).
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
          value={selectedPeriodId}
          onChange={handlePeriodChange}
          disabled={loading || payPeriods.length === 0}
        >
          {payPeriods.map((period) => (
            <option key={period.id} value={period.id}>
              {period.startDate} – {period.endDate} ({period.status.replace(/_/g, ' ')})
            </option>
          ))}
        </select>
        {run && (
          <span className="muted button-row-caption">
            Run #{run.runNumber} · rate set {run.rateSetVersion} · by {run.runByName}
          </span>
        )}
      </div>

      <div className="button-row">
        {canCalculate && (
          <button className="primary" onClick={handleCalculate} disabled={loading || !selectedPeriodId}>
            {loading && <span className="spinner" />}
            {loading ? 'Calculating…' : 'Calculate Payroll'}
          </button>
        )}
        {canRecalculate && (
          <button className="primary" onClick={handleRecalculate} disabled={loading}>
            {loading && <span className="spinner" />}
            {loading ? 'Recalculating…' : 'Recalculate (new run)'}
          </button>
        )}
        {canSubmit && (
          <button onClick={handleSubmit} disabled={loading}>
            Submit for Approval
          </button>
        )}
        {!canCalculate && !canRecalculate && selectedPeriod && (
          <span className="muted button-row-caption">
            This period is <strong>{periodStatus.replace(/_/g, ' ')}</strong> — payroll can no longer
            be recalculated here.
          </span>
        )}
        {periodStatus === PAYROLL_STATUS.PENDING_APPROVAL && (
          <span className="muted button-row-caption">
            Awaiting approval (UC-004). Recalculating moves it back to calculated.
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

      {successMessage && (
        <div className="banner success-banner">
          <span className="banner-icon" aria-hidden="true">
            ✓
          </span>
          <span>{successMessage}</span>
        </div>
      )}

      {summary?.varianceWarning && summary.variance && (
        <div className="banner warning-banner">
          <span className="banner-icon" aria-hidden="true">
            ⚠
          </span>
          <span>
            Variance warning: net payable ({formatMoney(summary.variance.currentNetPayable)}) is{' '}
            {summary.variance.pctChange}% away from the previous period's (
            {formatMoney(summary.variance.previousNetPayable)}) — over the{' '}
            {summary.variance.thresholdPct}% threshold. Review before submitting — the run itself
            completed normally.
          </span>
        </div>
      )}

      {dataChangedSinceRun && run && (
        <div className="banner warning-banner">
          <span className="banner-icon" aria-hidden="true">
            ⚠
          </span>
          <span>
            Adjustments changed since run #{run.runNumber} — recalculate to fold them into the
            payroll figures shown here.
          </span>
        </div>
      )}

      {run && run.linesIncomplete > 0 && (
        <div className="banner warning-banner">
          <span className="banner-icon" aria-hidden="true">
            ⚠
          </span>
          <span>
            {run.linesIncomplete} {run.linesIncomplete === 1 ? 'line is' : 'lines are'} incomplete and
            excluded from the period totals — see the reasons in the table below. The period cannot be
            submitted for approval until every line is complete.
          </span>
        </div>
      )}

      {run && (
        <div className="stat-grid">
          <div className="stat-tile">
            <p className="stat-label">Gross + Incentives</p>
            <div className="stat-value">{formatMoney(run.totals.gross)}</div>
            <p className="stat-sub">complete lines only</p>
          </div>
          <div className="stat-tile">
            <p className="stat-label">Employee Deductions</p>
            <div className="stat-value">{formatMoney(run.totals.employeeDeductions)}</div>
            <p className="stat-sub">CPF (employee) only</p>
          </div>
          <div className="stat-tile">
            <p className="stat-label">Employer Cost</p>
            <div className="stat-value">{formatMoney(run.totals.employerCost)}</div>
            <p className="stat-sub">CPF (employer) + SDL — not deducted from pay</p>
          </div>
          <div className="stat-tile">
            <p className="stat-label">Net Payable</p>
            <div className="stat-value">{formatMoney(run.totals.netPayable)}</div>
            <p className="stat-sub">what payment (UC-005) will pay out</p>
          </div>
          <div className="stat-tile">
            <p className="stat-label">Payroll Lines</p>
            <div className={`stat-value${run.linesIncomplete > 0 ? ' stat-warning' : ''}`}>
              {run.linesComplete + run.linesIncomplete}
            </div>
            <p className="stat-sub">
              {run.linesComplete} complete · {run.linesIncomplete} incomplete
            </p>
          </div>
        </div>
      )}

      <div className="tab-row" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'lines'}
          className={`tab${activeTab === 'lines' ? ' tab-active' : ''}`}
          onClick={() => setActiveTab('lines')}
        >
          Payroll Lines
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'adjustments'}
          className={`tab${activeTab === 'adjustments' ? ' tab-active' : ''}`}
          onClick={() => setActiveTab('adjustments')}
        >
          Adjustments
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'inputs'}
          className={`tab${activeTab === 'inputs' ? ' tab-active' : ''}`}
          onClick={() => {
            setResolveStaffId(null); // manual visit, not a resolve jump
            setActiveTab('inputs');
          }}
        >
          Performance Inputs
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'rates'}
          className={`tab${activeTab === 'rates' ? ' tab-active' : ''}`}
          onClick={() => setActiveTab('rates')}
        >
          Rate Sets
        </button>
      </div>

      {activeTab === 'lines' && (
        <div className="card">
          <div className="card-header">
            <h2>Per-Staff Payroll Lines</h2>
            {lines && (
              <span className="card-count">
                {lines.length} {lines.length === 1 ? 'staff member' : 'staff'}
              </span>
            )}
          </div>
          <PayrollLineTable
            lines={lines}
            onResolve={user?.role === 'manager' ? handleResolve : undefined}
          />
        </div>
      )}

      {activeTab === 'adjustments' && selectedPeriodId && (
        <AdjustmentsPanel
          periodId={selectedPeriodId}
          periodStatus={periodStatus}
          user={user}
          onChanged={() => setDataChangedSinceRun(true)}
        />
      )}

      {activeTab === 'inputs' && selectedPeriodId && (
        <PerformanceInputsPanel
          periodId={selectedPeriodId}
          periodStatus={periodStatus}
          user={user}
          resolveStaffId={resolveStaffId}
          onSaved={handleResolvedSaved}
        />
      )}

      {activeTab === 'rates' && <RateSetsPanel />}
    </div>
  );
}

export default PayrollCalcPage;
