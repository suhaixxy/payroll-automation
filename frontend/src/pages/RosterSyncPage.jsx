import { Fragment, useEffect, useState } from "react";
import { fetchPayPeriods, fetchSyncHistory, fetchSyncSummary, simulateSheetDown, triggerImportNow } from "../api/roster";
import ExceptionList from "../components/ExceptionList";
import SyncHistoryList from "../components/SyncHistoryList";
import SyncSummaryCard from "../components/SyncSummaryCard";
import "../styles/rosterSync.css";

function RosterSyncPage() {
  const [payPeriods, setPayPeriods] = useState([]);
  const [selectedPayPeriodId, setSelectedPayPeriodId] = useState("");
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [preservedDraft, setPreservedDraft] = useState(false);
  const [expandedStaffId, setExpandedStaffId] = useState(null);
  const today = new Date();
  const windowStart = new Date(today);
  const windowEnd = new Date(today);
  windowStart.setMonth(windowStart.getMonth() - 3);
  windowEnd.setMonth(windowEnd.getMonth() + 3);
  const visiblePayPeriods = payPeriods.filter((period) => {
    const startDate = new Date(`${period.startDate}T00:00:00`);
    const endDate = new Date(`${period.endDate}T23:59:59`);
    return endDate >= windowStart && startDate <= windowEnd;
  });

  async function refresh(payPeriodId) {
    const [nextSummary, nextHistory] = await Promise.all([fetchSyncSummary(payPeriodId), fetchSyncHistory(payPeriodId)]);
    setSummary(nextSummary);
    setHistory(nextHistory.history);
  }

  useEffect(() => {
    fetchPayPeriods().then((periods) => {
      setPayPeriods(periods);
      const selected = periods.find((period) => period.isActive) || periods[0];
      if (selected) {
        setSelectedPayPeriodId(selected.id);
        refresh(selected.id).catch((error) => setErrorMessage(error.message));
      }
    }).catch((error) => setErrorMessage(error.message));
  }, []);

  async function applyResult(result) {
    if (!result.success) {
      setErrorMessage(result.message);
      if (result.previousDraft) {
        setSummary(result.previousDraft);
        setPreservedDraft(true);
      }
    } else {
      setSummary(result);
      setPreservedDraft(false);
    }
    const nextHistory = await fetchSyncHistory(selectedPayPeriodId);
    setHistory(nextHistory.history);
  }

  async function runImport(action) {
    if (!selectedPayPeriodId) return;
    setLoading(true);
    setErrorMessage("");
    setPreservedDraft(false);
    try {
      await applyResult(await action(selectedPayPeriodId));
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="roster-page">
      <header className="roster-intro"><h1>UC-001: Roster Sync</h1><p>Import roster shifts, match staff, and maintain draft timesheets for the selected pay period.</p></header>
      <section className="roster-controls">
        <label htmlFor="pay-period">Pay period</label>
        <select id="pay-period" value={selectedPayPeriodId} onChange={(event) => { setSelectedPayPeriodId(event.target.value); setExpandedStaffId(null); refresh(event.target.value).catch((error) => setErrorMessage(error.message)); }} disabled={loading}>
          {visiblePayPeriods.map((period) => <option key={period.id} value={period.id}>{period.startDate} to {period.endDate}{period.isActive ? " (active)" : ""}</option>)}
        </select>
        <button className="roster-primary" onClick={() => runImport(triggerImportNow)} disabled={loading || !selectedPayPeriodId}>{loading ? "Syncing..." : "Import Now"}</button>
        <button className="roster-secondary" onClick={() => runImport(simulateSheetDown)} disabled={loading || !selectedPayPeriodId}>Simulate Sheet Down</button>
      </section>
      {errorMessage && <p className="roster-banner roster-error">{errorMessage}</p>}
      {preservedDraft && <p className="roster-banner roster-info">Last synced draft preserved; the live import could not complete.</p>}
      <SyncSummaryCard summary={summary} />
      <section className="roster-card"><h2>Draft Timesheet Totals</h2>{summary?.draftTimesheets?.length ? <div className="roster-table-scroll"><table><thead><tr><th>Staff ID</th><th>Name</th><th>Total hours</th><th>Shifts</th></tr></thead><tbody>{summary.draftTimesheets.map((staff) => <Fragment key={staff.staffId}><tr className="roster-expandable" onClick={() => setExpandedStaffId(expandedStaffId === staff.staffId ? null : staff.staffId)}><td>{staff.staffId}</td><td>{staff.fullName}</td><td>{staff.totalHours}</td><td>{expandedStaffId === staff.staffId ? "▲" : "▼"} {staff.shifts.length}</td></tr>{expandedStaffId === staff.staffId && <tr className="roster-breakdown"><td colSpan="4"><table><thead><tr><th>Date</th><th>Time</th><th>Hours</th><th>Matched by</th></tr></thead><tbody>{staff.shifts.map((shift, index) => <tr key={`${shift.date}-${index}`}><td>{shift.date}</td><td>{shift.clockIn}–{shift.clockOut}</td><td>{shift.hours}</td><td>{shift.matchedBy === "name" ? "Name fallback" : "Staff ID"}</td></tr>)}</tbody></table></td></tr>}</Fragment>)}</tbody></table></div> : <p className="roster-empty">No draft timesheets yet — run a sync to populate this table.</p>}</section>
      <section className="roster-card"><h2>Unmatched Entries</h2><ExceptionList items={summary?.unmatched} /></section>
      <section className="roster-card"><h2>Data Issues</h2><ExceptionList items={summary?.invalidTime} variant="invalidTime" /></section>
      <section className="roster-card"><h2>Sync History</h2><SyncHistoryList history={history} /></section>
    </main>
  );
}

export default RosterSyncPage;
