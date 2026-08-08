import React, { useState, useEffect } from 'react';
import { fetchRateSets, fetchRateSet } from '../api/client';
import { formatMoney } from './PayrollLineTable';

const formatPct = (fraction) => `${(Number(fraction) * 100).toFixed(2).replace(/\.?0+$/, '')}%`;

// UC-003 phase 6.3: read-only view of the statutory rate set versions. A
// rate set is never edited — a manager supersedes it by POSTing a new
// version (API only for now, per the guide) — so this panel has no pencil
// or trash on purpose. Every calculation run stays pinned to the version it
// used, which is what makes old payslips reproducible.
function RateSetsPanel() {
  const [rateSets, setRateSets] = useState(null); // null = loading
  const [selected, setSelected] = useState(null); // detail incl. bands
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setRateSets(null);
    setLoadError(null);
    const result = await fetchRateSets();
    if (!result.ok) {
      setLoadError(result.data?.error?.message || 'Could not load rate sets.');
      setRateSets([]);
      return;
    }
    const sets = result.data.data.rateSets || [];
    setRateSets(sets);
    // Default to the current (open-ended) version.
    const active = sets.find((set) => !set.effectiveTo) || sets[0];
    if (active) {
      const detail = await fetchRateSet(active.id);
      if (detail.ok) setSelected(detail.data.data);
    }
  }

  async function handleSelect(id) {
    const detail = await fetchRateSet(id);
    if (detail.ok) setSelected(detail.data.data);
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>Statutory Rate Sets</h2>
        <span className="card-count">
          read-only — a new version supersedes the old, existing runs keep theirs
        </span>
      </div>

      {loadError && (
        <div className="banner error-banner">
          <span className="banner-icon" aria-hidden="true">⨯</span>
          <span>
            {loadError}{' '}
            <button type="button" className="login-switch" onClick={load}>
              Retry
            </button>
          </span>
        </div>
      )}

      {rateSets === null ? (
        <p className="empty-state">
          <span className="spinner" /> Loading rate sets…
        </p>
      ) : rateSets.length === 0 ? (
        <p className="empty-state">No statutory rate sets exist yet — run the database seed.</p>
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Effective</th>
                  <th className="numeric">SDL</th>
                  <th className="numeric">OT ×</th>
                  <th className="numeric">PH ×</th>
                  <th className="numeric">CPF OW ceiling</th>
                  <th>Created by</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rateSets.map((set) => (
                  <tr key={set.id}>
                    <td>
                      <strong>{set.versionLabel}</strong>{' '}
                      {!set.effectiveTo && (
                        <span className="badge badge-good">
                          <span className="badge-dot" />
                          Current
                        </span>
                      )}
                    </td>
                    <td>
                      {set.effectiveFrom} → {set.effectiveTo || 'open'}
                    </td>
                    <td className="numeric">
                      {formatPct(set.sdlRate)} ({formatMoney(set.sdlMin)}–{formatMoney(set.sdlMax)},
                      first {formatMoney(set.sdlWageCap)})
                    </td>
                    <td className="numeric">{Number(set.otMultiplier)}</td>
                    <td className="numeric">{Number(set.phMultiplier)}</td>
                    <td className="numeric">{formatMoney(set.cpfOwCeiling)}</td>
                    <td>{set.createdByName}</td>
                    <td className="numeric">
                      <button type="button" onClick={() => handleSelect(set.id)}>
                        View bands
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selected && (
            <>
              <h3>
                CPF age bands — {selected.versionLabel}
                <span className="muted"> (rates verified against CPF Board tables, 1 Jan 2026)</span>
              </h3>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Age band</th>
                      <th className="numeric">Employee</th>
                      <th className="numeric">Employer</th>
                      <th className="numeric">Total</th>
                      <th className="numeric">No employee CPF below</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.bands.map((band) => (
                      <tr key={`${band.ageMin}`}>
                        <td>
                          {band.ageMax === null ? `above ${band.ageMin - 1}` : `${band.ageMin} – ${band.ageMax}`}
                        </td>
                        <td className="numeric">{formatPct(band.employeeRate)}</td>
                        <td className="numeric">{formatPct(band.employerRate)}</td>
                        <td className="numeric">
                          {formatPct(Number(band.employeeRate) + Number(band.employerRate))}
                        </td>
                        <td className="numeric">{formatMoney(band.minWageThreshold)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default RateSetsPanel;
