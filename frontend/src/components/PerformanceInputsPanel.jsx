import React, { useState, useEffect } from 'react';
import {
  fetchPerformanceInputs,
  createPerformanceInput,
  updatePerformanceInput,
  deletePerformanceInput,
  fetchUc003Staff,
} from '../api/client';
import { formatMoney } from './PayrollLineTable';

const INPUT_TYPE_SUGGESTIONS = ['sessions', 'courses', 'enrolments'];

const EMPTY_FORM = { staffId: '', inputType: 'sessions', quantity: '', unitValue: '', notes: '' };

// UC-003 phase 5.2: the Performance Inputs tab — quantity × unit_value rows
// that drive full-timer incentives (§5.3). Row-level pencil/trash at the
// right edge, "+ New" in the header (§2.1); buttons hidden for non-managers
// AND rejected server-side (§2.2). This panel is also the landing spot of
// the Resolve action (§5.8): `resolveStaffId` opens the create form
// pre-filled for the staff member whose line is incomplete.
function PerformanceInputsPanel({ periodId, periodStatus, user, resolveStaffId, onSaved }) {
  const [inputs, setInputs] = useState(null); // null = loading
  const [staffOptions, setStaffOptions] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | input id
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

  // Resolve flow: open the create form for the flagged staff member.
  useEffect(() => {
    if (resolveStaffId && canMutate) {
      setEditing('new');
      setForm({ ...EMPTY_FORM, staffId: resolveStaffId });
      setFormError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveStaffId]);

  async function load() {
    setInputs(null);
    setLoadError(null);
    const [listResult, staffResult] = await Promise.all([
      fetchPerformanceInputs(periodId),
      fetchUc003Staff(),
    ]);
    if (!listResult.ok) {
      setLoadError(listResult.data?.error?.message || 'Could not load performance inputs.');
      setInputs([]);
      return;
    }
    setInputs(listResult.data.data.performanceInputs || []);
    if (staffResult.ok) setStaffOptions(staffResult.data.data.staff || []);
  }

  function startNew() {
    setEditing('new');
    setForm({ ...EMPTY_FORM, staffId: staffOptions[0]?.id || '' });
    setFormError(null);
  }

  function startEdit(input) {
    setEditing(input.id);
    setForm({
      staffId: input.staffId,
      inputType: input.inputType,
      quantity: input.quantity,
      unitValue: input.unitValue,
      notes: input.notes || '',
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
      result = await createPerformanceInput({
        staffId: form.staffId,
        periodId,
        inputType: form.inputType,
        quantity: Number(form.quantity),
        unitValue: Number(form.unitValue),
        notes: form.notes || undefined,
      });
    } else {
      // §2.1: save only the fields that actually changed.
      const original = inputs.find((input) => input.id === editing);
      const changes = {};
      if (Number(form.quantity) !== Number(original.quantity)) changes.quantity = Number(form.quantity);
      if (Number(form.unitValue) !== Number(original.unitValue)) changes.unitValue = Number(form.unitValue);
      if (form.notes !== (original.notes || '')) changes.notes = form.notes;
      if (Object.keys(changes).length === 0) {
        setSaving(false);
        cancelEdit();
        return;
      }
      result = await updatePerformanceInput(editing, changes);
    }

    setSaving(false);
    if (!result.ok) {
      setFormError(result.data?.error?.message || 'Saving failed.');
      return;
    }
    cancelEdit();
    await load();
    onSaved?.();
  }

  async function handleDelete(input) {
    const confirmed = window.confirm(
      `Delete the '${input.inputType}' input (${input.quantity} × ${formatMoney(input.unitValue)}) for ${input.staffName}?`
    );
    if (!confirmed) return;

    const result = await deletePerformanceInput(input.id);
    if (!result.ok) {
      setLoadError(result.data?.error?.message || 'Delete failed.');
      return;
    }
    await load();
    onSaved?.();
  }

  const editorOpen = editing !== null;

  return (
    <div className="card">
      <div className="card-header">
        <h2>Performance Inputs</h2>
        <span>
          {inputs && (
            <span className="card-count">
              {inputs.length} {inputs.length === 1 ? 'input' : 'inputs'}
              {'  '}
            </span>
          )}
          {canMutate && !editorOpen && (
            <button type="button" onClick={startNew} disabled={staffOptions.length === 0}>
              + New Input
            </button>
          )}
        </span>
      </div>

      {locked && (
        <p className="muted">
          This period is <strong>{periodStatus}</strong> — performance inputs are locked.
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
        <div className="banner">
          <div style={{ width: '100%' }}>
            <strong>{editing === 'new' ? 'New performance input' : 'Edit performance input'}</strong>
            <div className="field-row">
              <div className="field-column">
                <label htmlFor="pi-staff">Staff</label>
                <select
                  id="pi-staff"
                  value={form.staffId}
                  disabled={editing !== 'new'} // staff/type/period immutable on edit
                  onChange={(event) => setForm({ ...form, staffId: event.target.value })}
                >
                  {staffOptions.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.externalRef} — {staff.fullName}
                      {staff.employmentType === 'full_time' ? '' : ' (part-time)'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-column">
                <label htmlFor="pi-type">Input type</label>
                <input
                  id="pi-type"
                  type="text"
                  list="pi-type-suggestions"
                  value={form.inputType}
                  disabled={editing !== 'new'}
                  onChange={(event) => setForm({ ...form, inputType: event.target.value })}
                />
                <datalist id="pi-type-suggestions">
                  {INPUT_TYPE_SUGGESTIONS.map((type) => (
                    <option key={type} value={type} />
                  ))}
                </datalist>
              </div>
              <div className="field-column">
                <label htmlFor="pi-quantity">Quantity</label>
                <input
                  id="pi-quantity"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.quantity}
                  onChange={(event) => setForm({ ...form, quantity: event.target.value })}
                />
              </div>
              <div className="field-column">
                <label htmlFor="pi-unit-value">$ per unit</label>
                <input
                  id="pi-unit-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unitValue}
                  onChange={(event) => setForm({ ...form, unitValue: event.target.value })}
                />
              </div>
            </div>
            <div className="field-row">
              <div className="field-column">
                <label htmlFor="pi-notes">Notes (optional)</label>
                <input
                  id="pi-notes"
                  type="text"
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                />
              </div>
            </div>
            {formError && <p className="line-note">{formError}</p>}
            <div className="button-row">
              <button
                type="button"
                className="primary"
                onClick={handleSave}
                disabled={
                  saving ||
                  !form.staffId ||
                  !form.inputType ||
                  form.quantity === '' ||
                  form.unitValue === ''
                }
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

      {inputs === null ? (
        <p className="empty-state">
          <span className="spinner" /> Loading performance inputs…
        </p>
      ) : inputs.length === 0 ? (
        <p className="empty-state">
          No performance inputs for this period
          {canMutate ? ' — add one with “+ New Input”.' : '.'}
        </p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Staff</th>
                <th>Type</th>
                <th className="numeric">Quantity</th>
                <th className="numeric">$ / unit</th>
                <th className="numeric">Incentive</th>
                <th>Notes</th>
                {canMutate && <th aria-label="actions" />}
              </tr>
            </thead>
            <tbody>
              {inputs.map((input) => (
                <tr key={input.id}>
                  <td>
                    {input.externalRef} — {input.staffName}
                  </td>
                  <td>
                    <span className="badge">{input.inputType}</span>
                  </td>
                  <td className="numeric">{input.quantity}</td>
                  <td className="numeric">{formatMoney(input.unitValue)}</td>
                  <td className="numeric">
                    <strong>{formatMoney(Number(input.quantity) * Number(input.unitValue))}</strong>
                  </td>
                  <td className="line-note" style={{ color: 'inherit' }}>
                    {input.notes || '—'}
                  </td>
                  {canMutate && (
                    <td className="numeric">
                      <button
                        type="button"
                        title="Edit"
                        aria-label={`Edit ${input.inputType} input for ${input.staffName}`}
                        onClick={() => startEdit(input)}
                      >
                        ✎
                      </button>{' '}
                      <button
                        type="button"
                        title="Delete"
                        aria-label={`Delete ${input.inputType} input for ${input.staffName}`}
                        onClick={() => handleDelete(input)}
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

export default PerformanceInputsPanel;
