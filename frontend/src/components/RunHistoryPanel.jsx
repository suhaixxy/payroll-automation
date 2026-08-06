import React, { useEffect, useState } from 'react';
import { fetchRunHistory, voidCalculationRun } from '../api/client';
import { formatMoney } from './PayrollLineTable';

// §5.9: every calculation run for the period, newest first, voided runs
// included with their reasons — the audit trail is the point, so nothing is
// hidden. A manager can void a run here (with a mandatory reason); the
// latest NON-voided complete run then becomes the authoritative one.
function RunHistoryPanel({ periodId, user, locked, onRunVoided }) {
  const [runs, setRuns] = useState(null);
  const [error, setError] = useState(null);
  const [voidingId, setVoidingId] = useState(null);

  async function load() {
    setError(null);
    const result = await fetchRunHistory(periodId);
    if (result.ok) setRuns(result.data.data.runs || []);
    else setError(result.data?.error?.message || 'Could not load the run history.');
  }

  useEffect(() => {
    setRuns(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodId]);

  async function handleVoid(run) {
    const reason = window.prompt(
      `Void run #${run.runNumber}? The latest remaining complete run becomes authoritative.\n\nReason (required):`
    );
    if (reason === null) return; // cancelled
    if (!reason.trim()) {
      setError('Voiding a run requires a reason.');
      return;
    }
    setVoidingId(run.id);
    const result = await voidCalculationRun(run.id, reason.trim());
    setVoidingId(null);
    if (!result.ok) {
      setError(result.data?.error?.message || 'Void failed.');
      return;
    }
    await load();
    onRunVoided?.();
  }

  if (error) {
    return (
      <div className="card">
        <div className="banner error-banner">
          <span className="banner-icon" aria-hidden="true">⨯</span>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!runs) {
    return (
      <div className="card">
        <p className="muted">Loading run history…</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>Calculation Runs</h2>
        <span className="card-count">
          {runs.length} {runs.length === 1 ? 'run' : 'runs'} · newest first
        </span>
      </div>
      {runs.length === 0 ? (
        <p className="empty-state">No runs yet — calculate the period to create run #1.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Run</th>
                <th>Status</th>
                <th>Run at</th>
                <th>By</th>
                <th>Rate set</th>
                <th className="numeric">Gross</th>
                <th className="numeric">Net Payable</th>
                <th className="numeric">Lines</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>#{run.runNumber}</td>
                  <td>
                    {run.status === 'voided' ? (
                      <>
                        <span className="badge badge-critical">
                          <span className="badge-dot" />
                          Voided
                        </span>
                        {run.voidReason && <div className="line-note">{run.voidReason}</div>}
                      </>
                    ) : (
                      <span className="badge badge-good">
                        <span className="badge-dot" />
                        {run.status === 'complete' ? 'Complete' : run.status}
                      </span>
                    )}
                  </td>
                  <td>{new Date(run.runAt).toLocaleString('en-SG')}</td>
                  <td>{run.runByName}</td>
                  <td>{run.rateSetVersion}</td>
                  <td className="numeric">{formatMoney(run.totalGross)}</td>
                  <td className="numeric">{formatMoney(run.totalNetPayable)}</td>
                  <td className="numeric">
                    {run.linesComplete} ✓{run.linesIncomplete > 0 ? ` · ${run.linesIncomplete} ✗` : ''}
                  </td>
                  <td>
                    {user?.role === 'manager' && run.status === 'complete' && !locked && (
                      <button
                        type="button"
                        onClick={() => handleVoid(run)}
                        disabled={voidingId !== null}
                      >
                        {voidingId === run.id ? 'Voiding…' : 'Void'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted">
        Runs are immutable — recalculating creates the next number instead of overwriting. Only the
        latest non-voided complete run feeds the totals, lines, and export above.
      </p>
    </div>
  );
}

export default RunHistoryPanel;
