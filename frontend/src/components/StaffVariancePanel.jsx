import React, { useEffect, useState } from 'react';
import { fetchStaffVariance } from '../api/client';
import { formatMoney } from './PayrollLineTable';

// §7.2: per-staff net-pay comparison between this period's authoritative
// run and the previous period's. The period-level variance banner says
// "something moved"; this table says WHO — sorted by biggest move first.
function StaffVariancePanel({ periodId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    fetchStaffVariance(periodId).then((result) => {
      if (cancelled) return;
      if (result.ok) setData(result.data.data);
      else setError(result.data?.error?.message || 'Could not load the comparison.');
    });
    return () => {
      cancelled = true;
    };
  }, [periodId]);

  if (error) return <p className="line-note">{error}</p>;
  if (!data) return <p className="muted">Loading per-staff comparison…</p>;

  if (!data.previousPeriod) {
    return (
      <p className="empty-state">
        No earlier period has a completed run yet — there is nothing to compare against. Once a
        previous period is calculated, the per-staff deltas appear here.
      </p>
    );
  }

  return (
    <div className="table-scroll">
      <p className="muted">
        Net payable: run #{data.currentRun.runNumber} of this period vs run #
        {data.previousPeriod.runNumber} of {data.previousPeriod.startDate} –{' '}
        {data.previousPeriod.endDate}. Biggest movements first.
      </p>
      <table>
        <thead>
          <tr>
            <th>Staff ID</th>
            <th>Name</th>
            <th className="numeric">Previous Net</th>
            <th className="numeric">Current Net</th>
            <th className="numeric">Δ</th>
            <th className="numeric">Δ %</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.staffId}>
              <td>{row.externalRef}</td>
              <td>{row.staffName}</td>
              <td className="numeric">
                {row.previousNet !== null ? (
                  formatMoney(row.previousNet)
                ) : (
                  <span className="muted">
                    {row.previousLineStatus === 'incomplete' ? 'incomplete' : 'not in run'}
                  </span>
                )}
              </td>
              <td className="numeric">
                {row.currentNet !== null ? (
                  formatMoney(row.currentNet)
                ) : (
                  <span className="muted">
                    {row.currentLineStatus === 'incomplete' ? 'incomplete' : 'not in run'}
                  </span>
                )}
              </td>
              <td className={`numeric${Number(row.delta) !== 0 && row.delta !== null ? ' delta-nonzero' : ''}`}>
                {row.delta !== null ? (
                  <>
                    {Number(row.delta) > 0 ? '+' : ''}
                    {formatMoney(row.delta)}
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td className="numeric">
                {row.deltaPct !== null ? `${row.deltaPct > 0 ? '+' : ''}${row.deltaPct}%` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default StaffVariancePanel;
