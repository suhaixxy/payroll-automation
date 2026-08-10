import React, { useEffect, useState } from 'react';
import { fetchPayrollLine } from '../api/client';
import { formatMoney } from './PayrollLineTable';

// §7.3: the "show your working" modal for one payroll line. Renders the
// calc_breakdown the engine stored WITH the run (never recomputed), plus
// the run provenance so an auditor can see exactly which execution, rate
// set, and person produced these numbers.
function LineBreakdownModal({ lineId, onClose }) {
  const [line, setLine] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchPayrollLine(lineId).then((result) => {
      if (cancelled) return;
      if (result.ok) setLine(result.data.data);
      else setError(result.data?.error?.message || 'Could not load the breakdown.');
    });
    return () => {
      cancelled = true;
    };
  }, [lineId]);

  // Close on Escape — modals that only close via the button are a trap.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const breakdown = line?.calcBreakdown || [];

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Calculation breakdown"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="card-header">
          <h3>
            {line ? `${line.staffName} (${line.externalRef})` : 'Calculation breakdown'}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {error && <p className="line-note">{error}</p>}
        {!line && !error && <p className="muted">Loading breakdown…</p>}

        {line && (
          <>
            <p className="muted modal-provenance">
              Run #{line.runNumber} · rate set {line.rateSetVersion} · by {line.runByName} ·{' '}
              {new Date(line.runAt).toLocaleString('en-SG')}
            </p>

            {(line.incompleteReasons || []).map((reason) => (
              <div key={reason.code} className="banner warning-banner">
                <span className="banner-icon" aria-hidden="true">
                  ⚠
                </span>
                <span>{reason.message}</span>
              </div>
            ))}

            {breakdown.length === 0 ? (
              <p className="empty-state">
                No calculation steps were recorded — the line stopped before any amount could be
                derived (see the reason above).
              </p>
            ) : (
              <table className="breakdown-table">
                <tbody>
                  {breakdown.map((step, index) => (
                    <tr
                      key={index}
                      className={
                        step.isTotal ? 'breakdown-total' : step.isSubtotal ? 'breakdown-subtotal' : ''
                      }
                    >
                      <td>{step.label}</td>
                      <td className="muted">{step.detail}</td>
                      <td className="numeric">{formatMoney(step.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <p className="muted modal-footnote">
              Employer-borne amounts (CPF employer {formatMoney(line.cpf_employer)}, SDL{' '}
              {formatMoney(line.sdl)}) are costs on top of pay — they are never deducted from the
              employee.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default LineBreakdownModal;
