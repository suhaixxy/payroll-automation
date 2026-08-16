import React, { useState, useEffect } from 'react';
import { fetchEditHistory } from '../api/client';

const FIELD_LABELS = {
  regularHours: 'Regular Hours',
  otHours: 'OT Hours',
  phHours: 'PH Hours',
  hourlyRateUsed: 'Hourly Rate',
  grossFromHours: 'Gross from Hours',
  incentiveAmount: 'Incentive',
  adjustmentsTotal: 'Adjustments',
  grossTotal: 'Gross Total',
  cpfEmployee: 'CPF (Employee)',
  cpfEmployer: 'CPF (Employer)',
  sdl: 'SDL',
  netPay: 'Net Pay',
  amount: 'Amount',
  cpfApplicable: 'CPF Applicable',
  reason: 'Reason',
  adjustmentType: 'Type',
  quantity: 'Quantity',
  unitValue: 'Unit Value',
  inputType: 'Input Type',
  notes: 'Notes',
  staffId: 'Staff',
};

function formatField(key) {
  return FIELD_LABELS[key] || key.replace(/([A-Z])/g, ' $1').trim();
}

function formatTimestamp(iso) {
  const d = new Date(iso);
  return d.toLocaleString('en-SG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function EditHistoryModal({ entityType, entityId, entityLabel, onClose }) {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchEditHistory(entityType, entityId).then((result) => {
      setLoading(false);
      if (result.ok) {
        setHistory(result.data?.data?.history || []);
      } else {
        setError('Could not load edit history.');
      }
    });
  }, [entityType, entityId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal edit-history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit History — {entityLabel}</h3>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        {loading && <p className="muted"><span className="spinner" /> Loading history…</p>}
        {error && <p className="line-note">{error}</p>}

        {!loading && !error && history.length === 0 && (
          <p className="muted">No edits recorded yet — this record hasn't been changed since creation.</p>
        )}

        {!loading && history.length > 0 && (
          <div className="edit-history-timeline">
            {history.map((entry) => (
              <div key={entry.id} className={`edit-history-entry edit-action-${entry.action}`}>
                <div className="edit-history-header">
                  <span className={`badge ${
                    entry.action === 'created' ? 'badge-good' :
                    entry.action === 'deleted' ? 'badge-critical' : 'badge-warning'
                  }`}>
                    <span className="badge-dot" />
                    {entry.action === 'created' ? 'Created' : entry.action === 'deleted' ? 'Deleted' : 'Updated'}
                  </span>
                  <span className="edit-history-meta">
                    by <strong>{entry.userName}</strong> · {formatTimestamp(entry.createdAt)}
                  </span>
                </div>
                {entry.changes && Object.keys(entry.changes).length > 0 && (
                  <div className="edit-history-changes">
                    {Object.entries(entry.changes).map(([field, diff]) => (
                      <div key={field} className="edit-history-change">
                        <span className="edit-history-field">{formatField(field)}</span>
                        {diff.from !== undefined ? (
                          <>
                            <span className="edit-history-from">{diff.from}</span>
                            <span className="edit-history-arrow">→</span>
                            <span className="edit-history-to">{diff.to}</span>
                          </>
                        ) : (
                          <span className="edit-history-to">{typeof diff === 'object' ? JSON.stringify(diff) : String(diff)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default EditHistoryModal;
