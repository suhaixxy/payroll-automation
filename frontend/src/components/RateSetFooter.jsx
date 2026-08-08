import React, { useState, useEffect } from 'react';
import { fetchRateSets, fetchRateSet } from '../api/client';

const formatPct = (fraction) => `${(Number(fraction) * 100).toFixed(2).replace(/\.?0+$/, '')}%`;

// Compact informational footer showing the active statutory rate set.
// Rate sets are versioned snapshots of CPF/SDL/OT/PH rates that every
// calculation run pins to — they make historical payroll reproducible.
// Read-only; a new version supersedes the old one (never edited in place).
function RateSetFooter() {
  const [rateSet, setRateSet] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const listResult = await fetchRateSets();
    if (!listResult.ok) { setLoading(false); return; }
    const sets = listResult.data?.data?.rateSets || [];
    const active = sets.find((s) => !s.effectiveTo) || sets[0];
    if (active) {
      const detail = await fetchRateSet(active.id);
      if (detail.ok) setRateSet(detail.data.data);
    }
    setLoading(false);
  }

  if (loading || !rateSet) return null;

  const { versionLabel, effectiveFrom, effectiveTo, cpfOwCeiling, otMultiplier, phMultiplier, sdlRate, sdlMin, sdlMax, cpfBands } = rateSet;

  return (
    <div className="rate-set-footer">
      <button type="button" className="rate-set-toggle" onClick={() => setExpanded(!expanded)}>
        <span className="rate-set-toggle-icon">{expanded ? '▾' : '▸'}</span>
        <strong>Statutory Rate Set: {versionLabel}</strong>
        <span className="muted"> · effective {effectiveFrom}{effectiveTo ? ` to ${effectiveTo}` : ' (current)'}</span>
      </button>
      {expanded && (
        <div className="rate-set-detail">
          <div className="rate-set-summary-row">
            <div className="rate-set-stat">
              <span className="stat-label">CPF OW Ceiling</span>
              <span className="stat-value">${Number(cpfOwCeiling).toLocaleString()}</span>
            </div>
            <div className="rate-set-stat">
              <span className="stat-label">OT Multiplier</span>
              <span className="stat-value">{otMultiplier}×</span>
            </div>
            <div className="rate-set-stat">
              <span className="stat-label">PH Multiplier</span>
              <span className="stat-value">{phMultiplier}×</span>
            </div>
            <div className="rate-set-stat">
              <span className="stat-label">SDL Rate</span>
              <span className="stat-value">{formatPct(sdlRate)}</span>
              <span className="muted">min ${sdlMin} / max ${sdlMax}</span>
            </div>
          </div>
          {cpfBands && cpfBands.length > 0 && (
            <div className="table-scroll">
              <table className="rate-set-table">
                <thead>
                  <tr>
                    <th>Age Band</th>
                    <th className="numeric">Employee Rate</th>
                    <th className="numeric">Employer Rate</th>
                    <th className="numeric">Min Wage Threshold</th>
                  </tr>
                </thead>
                <tbody>
                  {cpfBands.map((band, index) => (
                    <tr key={index}>
                      <td>{band.ageMin}–{band.ageMax || 'above'}</td>
                      <td className="numeric">{formatPct(band.employeeRate)}</td>
                      <td className="numeric">{formatPct(band.employerRate)}</td>
                      <td className="numeric">${band.minWageThreshold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted rate-set-note">
            Rate sets are versioned and never edited — a new version supersedes the old one.
            Each calculation run is pinned to the rate set it used, so historical payroll stays reproducible.
          </p>
        </div>
      )}
    </div>
  );
}

export default RateSetFooter;
