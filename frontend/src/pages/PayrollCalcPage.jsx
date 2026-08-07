import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getAccessToken,
  clearAccessToken,
  fetchPayrollPeriods,
  calculatePayroll,
  recalculatePayroll,
  submitForApproval,
  fetchPayrollSummary,
  fetchPayrollLines,
  downloadPayrollRegister,
} from '../api/client';
import PayrollLineTable, { formatMoney } from '../components/PayrollLineTable';
import AdjustmentsPanel from '../components/AdjustmentsPanel';
import PerformanceInputsPanel from '../components/PerformanceInputsPanel';
import RateSetsPanel from '../components/RateSetsPanel';
import RunHistoryPanel from '../components/RunHistoryPanel';
import StaffVariancePanel from '../components/StaffVariancePanel';
import LineBreakdownModal from '../components/LineBreakdownModal';
// Shared status contract (UC-003 guide §5.1) — same file the backend uses.
import payrollStatus from '../../../shared/payrollStatus.json';

const PAYROLL_STATUS = payrollStatus.statuses;
const LINES_PER_PAGE = 20;
const DEFAULT_LINE_QUERY = { search: '', status: '', sort: 'name', dir: 'asc', page: 1 };

// UC-003 page: pick a validated pay period and run the payroll calculation
// on its frozen hour snapshot. Every execution is a numbered, immutable
// calculation RUN pinned to a statutory rate set; recalculating creates the
// next run instead of overwriting. A manager then submits the calculated
// period to approval (UC-004). Requires a login — every run is tied to who
// triggered it.
function PayrollCalcPage() {
  const { user, signOut } = useAuth();
  const [payPeriods, setPayPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [summary, setSummary] = useState(null); // { period, run, variance... }
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('lines'); // lines | adjustments | inputs | rates | runs
  const [dataChangedSinceRun, setDataChangedSinceRun] = useState(false);
  // §5.8 resolve loop: which staff member's missing input we're fixing.
  const [resolveStaffId, setResolveStaffId] = useState(null);

  // §7.5: server-side search/filter/sort/paging on the lines table.
  const [lines, setLines] = useState(null);
  const [linesMeta, setLinesMeta] = useState(null);
  const [linesLoading, setLinesLoading] = useState(false);
  const [lineQuery, setLineQuery] = useState(DEFAULT_LINE_QUERY);
  const [searchDraft, setSearchDraft] = useState('');
  const [linesRefresh, setLinesRefresh] = useState(0); // bump to force a refetch

  const [breakdownLineId, setBreakdownLineId] = useState(null); // §7.3 modal
  const [showVariance, setShowVariance] = useState(false); // §7.2 panel
  const [exporting, setExporting] = useState(false); // §7.9 CSV

  useEffect(() => {
    if (!user) return;
    loadPeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Debounce the search box so we don't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setLineQuery((query) =>
        query.search === searchDraft ? query : { ...query, search: searchDraft, page: 1 }
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  // The lines table refetches itself whenever the period, any query knob, or
  // the refresh counter (bumped after calculate/void/etc.) changes.
  useEffect(() => {
    if (!user || !selectedPeriodId) return;
    let cancelled = false;
    setLinesLoading(true);
    fetchPayrollLines(selectedPeriodId, { ...lineQuery, limit: LINES_PER_PAGE }).then((result) => {
      if (cancelled) return;
      if (sessionExpired(result)) return;
      if (result.ok) {
        setLines(result.data.data.lines || []);
        setLinesMeta(result.data.meta || null);
      } else {
        setLines([]);
        setLinesMeta(null);
      }
      setLinesLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedPeriodId, lineQuery, linesRefresh]);

  // A 401 means the token expired mid-session — the global auth context
  // handles the redirect to /login via its payroll:unauthorized listener.
  function sessionExpired(result) {
    if (result.status === 401) {
      clearAccessToken();
      signOut();
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
      loadSummary(defaultPeriod.id);
    }
  }

  async function loadSummary(periodId) {
    setSummary(null);
    const result = await fetchPayrollSummary(periodId);
    if (sessionExpired(result)) return;
    if (result.ok) setSummary(result.data.data);
  }

  function refreshLines() {
    setLinesRefresh((count) => count + 1);
  }

  function handlePeriodChange(event) {
    const periodId = event.target.value;
    setSelectedPeriodId(periodId);
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowVariance(false);
    setSearchDraft('');
    setLineQuery(DEFAULT_LINE_QUERY); // fresh period, fresh table
    loadSummary(periodId);
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
      refreshLines();
      await Promise.all([loadSummary(selectedPeriodId), loadPeriods(selectedPeriodId)]);
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

  // §7.5 sort: clicking the active column flips direction, a new column
  // starts ascending; either way back to page 1.
  function handleSort(sortKey) {
    setLineQuery((query) => ({
      ...query,
      sort: sortKey,
      dir: query.sort === sortKey && query.dir === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
  }

  // §7.9: download the payroll register CSV of the authoritative run.
  async function handleExport() {
    setExporting(true);
    setErrorMessage(null);
    const result = await downloadPayrollRegister(selectedPeriodId);
    if (!result.ok && !sessionExpired(result)) {
      setErrorMessage(result.data?.error?.message || 'CSV export failed.');
    }
    setExporting(false);
  }

  const selectedPeriod = payPeriods.find((period) => period.id === selectedPeriodId);
  const periodStatus = selectedPeriod?.status;
  const run = summary?.run;
  const periodLocked = payrollStatus.uc003Locked.includes(periodStatus);

  const canCalculate = periodStatus === PAYROLL_STATUS.VALIDATED;
  const canRecalculate =
    periodStatus === PAYROLL_STATUS.CALCULATED || periodStatus === PAYROLL_STATUS.PENDING_APPROVAL;
  const canSubmit = periodStatus === PAYROLL_STATUS.CALCULATED && user?.role === 'manager';

  const hasFilters = Boolean(lineQuery.search || lineQuery.status);
  const totalLines = linesMeta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalLines / LINES_PER_PAGE));

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
        {periodStatus === PAYROLL_STATUS.DRAFT && selectedPeriod && (
          <span className="muted button-row-caption">
            This period is <strong>draft</strong> — validate it in Timesheet Validation before calculating payroll.
          </span>
        )}
        {!canCalculate && !canRecalculate && selectedPeriod && periodStatus !== PAYROLL_STATUS.DRAFT && periodStatus !== PAYROLL_STATUS.PENDING_APPROVAL && (
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
            completed normally.{' '}
            <button
              type="button"
              className="login-switch"
              onClick={() => {
                setShowVariance(true);
                setActiveTab('lines');
              }}
            >
              See who moved
            </button>
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
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'runs'}
          className={`tab${activeTab === 'runs' ? ' tab-active' : ''}`}
          onClick={() => setActiveTab('runs')}
        >
          Run History
        </button>
      </div>

      {activeTab === 'lines' && showVariance && (
        <div className="card">
          <div className="card-header">
            <h2>Per-Staff Comparison</h2>
            <button type="button" onClick={() => setShowVariance(false)}>
              Hide
            </button>
          </div>
          <StaffVariancePanel periodId={selectedPeriodId} />
        </div>
      )}

      {activeTab === 'lines' && (
        <div className="card">
          <div className="card-header">
            <h2>Per-Staff Payroll Lines</h2>
            <div className="button-row card-actions">
              {run && !showVariance && (
                <button type="button" onClick={() => setShowVariance(true)}>
                  Compare vs previous period
                </button>
              )}
              {run && (
                <button type="button" onClick={handleExport} disabled={exporting}>
                  {exporting && <span className="spinner" />}
                  {exporting ? 'Exporting…' : 'Export CSV'}
                </button>
              )}
              {linesMeta && (
                <span className="card-count">
                  {totalLines} {totalLines === 1 ? 'staff member' : 'staff'}
                  {hasFilters ? ' (filtered)' : ''}
                </span>
              )}
            </div>
          </div>

          {run && (
            <div className="field-row table-controls">
              <input
                type="search"
                placeholder="Search name or staff ID…"
                aria-label="Search payroll lines"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
              />
              <select
                aria-label="Filter by line status"
                value={lineQuery.status}
                onChange={(event) =>
                  setLineQuery((query) => ({ ...query, status: event.target.value, page: 1 }))
                }
              >
                <option value="">All statuses</option>
                <option value="complete">Complete only</option>
                <option value="incomplete">Incomplete only</option>
              </select>
              {linesLoading && <span className="spinner" aria-label="Loading lines" />}
            </div>
          )}

          {lines === null ? (
            <p className="muted">Loading payroll lines…</p>
          ) : (
          <PayrollLineTable
            lines={lines}
            filtered={hasFilters}
            sort={lineQuery.sort}
            dir={lineQuery.dir}
            onSort={handleSort}
            onShowBreakdown={(line) => setBreakdownLineId(line.id)}
            onResolve={user?.role === 'manager' ? handleResolve : undefined}
          />
          )}

          {totalPages > 1 && (
            <div className="button-row pagination">
              <button
                type="button"
                disabled={lineQuery.page <= 1 || linesLoading}
                onClick={() => setLineQuery((query) => ({ ...query, page: query.page - 1 }))}
              >
                ← Previous
              </button>
              <span className="muted">
                Page {lineQuery.page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={lineQuery.page >= totalPages || linesLoading}
                onClick={() => setLineQuery((query) => ({ ...query, page: query.page + 1 }))}
              >
                Next →
              </button>
            </div>
          )}
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

      {activeTab === 'runs' && selectedPeriodId && (
        <RunHistoryPanel
          periodId={selectedPeriodId}
          user={user}
          locked={periodLocked}
          onRunVoided={() => {
            refreshLines();
            loadSummary(selectedPeriodId);
          }}
        />
      )}

      {breakdownLineId && (
        <LineBreakdownModal lineId={breakdownLineId} onClose={() => setBreakdownLineId(null)} />
      )}
    </div>
  );
}

export default PayrollCalcPage;
