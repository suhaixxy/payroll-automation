import React, { useState, useEffect } from 'react';
import {
  fetchAdjustments,
  createAdjustment,
  updateAdjustment,
  deleteAdjustment,
  fetchUc003Staff,
} from '../api/client';
import { formatMoney } from './PayrollLineTable';

const ADJUSTMENT_TYPES = ['bonus', 'allowance', 'deduction', 'clawback', 'correction'];

const EMPTY_FORM = {
  staffId: '',
  adjustmentType: 'bonus',
  amount: '',
  cpfApplicable: true,
  reason: '',
};

// UC-003 phase 4.8: the Adjustments tab — list with row-level pencil/trash
// at the right edge and a "+ New" button in the header (guide §2.1). The
// buttons are hidden for non-managers AND the endpoints reject non-managers
// server-side; hiding a button is not authorisation (§2.2). Mutations are
// blocked once the period is approved or paid.
function AdjustmentsPanel({ periodId, periodStatus, user, onChanged }) {
  const [adjustments, setAdjustments] = useState(null); // null = loading
  const [staffOptions, setStaffOptions] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | adjustment id
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const isManager = user?.role === 'manager';
  const locked = periodStatus === 'approved' || periodStatus === 'paid';
  const canMutate = isManager && !locked;

  useEffect(() => {
    load();
    setEditing(null);
    setFormError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodId]);

  async function load() {
    setAdjustments(null);
    setLoadError(null);
    const [listResult, staffResult] = await Promise.all([
      fetchAdjustments(periodId),
      fetchUc003Staff(),
    ]);
    if (!listResult.ok) {
      setLoadError(listResult.data?.error?.message || 'Could not load adjustments.');
      setAdjustments([]);
      return;
    }
    setAdjustments(listResult.data.data.adjustments || []);
    if (staffResult.ok) setStaffOptions(staffResult.data.data.staff || []);
  }

  function startNew() {
    setEditing('new');
    setForm({ ...EMPTY_FORM, staffId: staffOptions[0]?.id || '' });
    setFormError(null);
  }

  function startEdit(adjustment) {
    setEditing(adjustment.id);
    setForm({
      staffId: adjustment.staffId,
      adjustmentType: adjustment.adjustmentType,
      amount: adjustment.amount,
      cpfApplicable: adjustment.cpfApplicable,
      reason: adjustment.reason,
    });
    setFormError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setFormError(null);
  }

  async function handleSave() {
    setSaving(true);
    setFormError(null);

    let result;
    if (editing === 'new') {
      result = await createAdjustment({
        staffId: form.staffId,
        periodId,
        adjustmentType: form.adjustmentType,
        amount: Number(form.amount),
        cpfApplicable: form.cpfApplicable,
        reason: form.reason,
      });
    } else {
      // §2.1: save only the fields that actually changed.
      const original = adjustments.find((adjustment) => adjustment.id === editing);
      const changes = {};
      if (form.adjustmentType !== original.adjustmentType) changes.adjustmentType = form.adjustmentType;
      if (Number(form.amount) !== Number(original.amount)) changes.amount = Number(form.amount);
      if (form.cpfApplicable !== original.cpfApplicable) changes.cpfApplicable = form.cpfApplicable;
      if (form.reason !== original.reason) changes.reason = form.reason;
      if (Object.keys(changes).length === 0) {
        setSaving(false);
        cancelEdit();
        return;
      }
      result = await updateAdjustment(editing, changes);
    }

    setSaving(false);
    if (!result.ok) {
      setFormError(result.data?.error?.message || 'Saving failed.');
      return;
    }
    cancelEdit();
    await load();
    onChanged?.();
  }

  async function handleDelete(adjustment) {
    // §2.1: delete always confirms first.
    const confirmed = window.confirm(
      `Delete this ${adjustment.adjustmentType} of ${formatMoney(adjustment.amount)} for ${adjustment.staffName}?`
    );
    if (!confirmed) return;

    const result = await deleteAdjustment(adjustment.id);
    if (!result.ok) {
      setLoadError(result.data?.error?.message || 'Delete failed.');
      return;
    }
    await load();
    onChanged?.();
  }

  const editorOpen = editing !== null;

  return (
    <div className="card">
      <div className="card-header">
        <h2>Adjustments</h2>
        <span>
          {adjustments && (
            <span className="card-count">
              {adjustments.length} {adjustments.length === 1 ? 'adjustment' : 'adjustments'}
              {'  '}
            </span>
          )}
          {canMutate && !editorOpen && (
            <button type="button" onClick={startNew} disabled={staffOptions.length === 0}>
              + New Adjustment
            </button>
          )}
        </span>
      </div>

      {locked && (
        <p className="muted">
          This period is <strong>{periodStatus}</strong> — adjustments are locked.
        </p>
      )}

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

      {editorOpen && (
        <div className="inline-editor">
          <div style={{ width: '100%' }}>
            <strong>{editing === 'new' ? 'New adjustment' : 'Edit adjustment'}</strong>
            <div className="field-row">
              <div className="field-column">
                <label htmlFor="adj-staff">Staff</label>
                <select
                  id="adj-staff"
                  value={form.staffId}
                  disabled={editing !== 'new'} // staff/period are immutable on edit
                  onChange={(event) => setForm({ ...form, staffId: event.target.value })}
                >
                  {staffOptions.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.externalRef} — {staff.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-column">
                <label htmlFor="adj-type">Type</label>
                <select
                  id="adj-type"
                  value={form.adjustmentType}
                  onChange={(event) => setForm({ ...form, adjustmentType: event.target.value })}
                >
                  {ADJUSTMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-column">
                <label htmlFor="adj-amount">Amount (SGD, negative reduces pay)</label>
                <input
                  id="adj-amount"
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                />
              </div>
            </div>
            <div className="field-row">
              <div className="field-column">
                <label htmlFor="adj-reason">Reason (required — it goes on the audit trail)</label>
                <input
                  id="adj-reason"
                  type="text"
                  value={form.reason}
                  onChange={(event) => setForm({ ...form, reason: event.target.value })}
                />
              </div>
              <div className="field-column">
                <label htmlFor="adj-cpf">
                  <input
                    id="adj-cpf"
                    type="checkbox"
                    checked={form.cpfApplicable}
                    onChange={(event) => setForm({ ...form, cpfApplicable: event.target.checked })}
                  />{' '}
                  CPF-applicable (enters the CPF wage base)
                </label>
              </div>
            </div>
            {formError && <p className="line-note">{formError}</p>}
            <div className="button-row">
              <button
                type="button"
                className="primary"
                onClick={handleSave}
                disabled={saving || !form.staffId || form.amount === '' || !form.reason}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={cancelEdit} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {adjustments === null ? (
        <p className="empty-state">
          <span className="spinner" /> Loading adjustments…
        </p>
      ) : adjustments.length === 0 ? (
        <p className="empty-state">
          No adjustments for this period{canMutate ? ' — add one with “+ New Adjustment”.' : '.'}
        </p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Staff</th>
                <th>Type</th>
                <th className="numeric">Amount</th>
                <th>CPF</th>
                <th>Reason</th>
                {canMutate && <th aria-label="actions" />}
              </tr>
            </thead>
            <tbody>
              {adjustments.map((adjustment) => (
                <tr key={adjustment.id}>
                  <td>
                    {adjustment.externalRef} — {adjustment.staffName}
                  </td>
                  <td>
                    <span className="badge">{adjustment.adjustmentType}</span>
                  </td>
                  <td className="numeric">
                    <strong>{formatMoney(adjustment.amount)}</strong>
                  </td>
                  <td>{adjustment.cpfApplicable ? 'CPF-applicable' : 'Not CPF'}</td>
                  <td className="line-note" style={{ color: 'inherit' }}>
                    {adjustment.reason}
                  </td>
                  {canMutate && (
                    <td className="numeric">
                      <button
                        type="button"
                        title="Edit"
                        aria-label={`Edit adjustment for ${adjustment.staffName}`}
                        onClick={() => startEdit(adjustment)}
                      >
                        ✎
                      </button>{' '}
                      <button
                        type="button"
                        title="Delete"
                        aria-label={`Delete adjustment for ${adjustment.staffName}`}
                        onClick={() => handleDelete(adjustment)}
                      >
                        🗑
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdjustmentsPanel;
