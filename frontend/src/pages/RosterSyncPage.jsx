import { useState, useEffect } from "react";
import {
  fetchPayPeriods,
  fetchSyncSummary,
  triggerImportNow,
  simulateSheetDown,
  fetchSyncHistory,
} from "../api/roster";
import SyncSummaryCard from "../components/SyncSummaryCard";
import ExceptionList from "../components/ExceptionList";
import SyncHistoryList from "../components/SyncHistoryList";

// UC-001 page: accounting staff can pick a pay period, trigger a manual
// roster sync for it, and see the results — sync summary, per-staff shift
// breakdown, unmatched/data-issue entries, and recent sync history.
function RosterSyncPage() {
  const [payPeriods, setPayPeriods] = useState([]);
  const [selectedPayPeriodId, setSelectedPayPeriodId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  function refreshSummaryAndHistory(payPeriodId) {
    fetchSyncSummary(payPeriodId).then(setSummary);
    fetchSyncHistory(payPeriodId).then((res) => setHistory(res.history));
  }

  useEffect(() => {
    fetchPayPeriods().then((periods) => {
      setPayPeriods(periods);
      const defaultPeriod = periods.find((period) => period.isActive) || periods[0];
      if (defaultPeriod) {
        setSelectedPayPeriodId(defaultPeriod.id);
        refreshSummaryAndHistory(defaultPeriod.id);
      }
    });
  }, []);

  function handlePayPeriodChange(event) {
    const payPeriodId = event.target.value;
    setSelectedPayPeriodId(payPeriodId);
    setErrorMessage(null);
    refreshSummaryAndHistory(payPeriodId);
  }

  async function handleImportNow() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await triggerImportNow(selectedPayPeriodId);
      if (!result.success) {
        setErrorMessage(result.message);
        if (result.previousDraft) setSummary(result.previousDraft);
      } else {
        setSummary(result);
      }
      fetchSyncHistory(selectedPayPeriodId).then((res) => setHistory(res.history));
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSimulateFailure() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await simulateSheetDown(selectedPayPeriodId);
      setErrorMessage(result.message);
      if (result.previousDraft) setSummary(result.previousDraft);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>UC-001: Roster Sync</h1>

      <div>
        <label>Pay Period: </label>
        <select value={selectedPayPeriodId || ""} onChange={handlePayPeriodChange}>
          {payPeriods.map((period) => (
            <option key={period.id} value={period.id}>
              {period.startDate} to {period.endDate} {period.isActive ? "(active)" : ""}
            </option>
          ))}
        </select>
      </div>

      <button onClick={handleImportNow} disabled={loading}>
        {loading ? "Syncing..." : "Import Now"}
      </button>
      <button onClick={handleSimulateFailure} disabled={loading}>
        Simulate Sheet Down (demo)
      </button>

      {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}

      <SyncSummaryCard summary={summary} />
      <ExceptionList unmatched={summary?.unmatched} invalidTime={summary?.invalidTime} />
      <SyncHistoryList history={history} />
    </div>
  );
}

export default RosterSyncPage;