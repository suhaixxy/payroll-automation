import React, { useState } from 'react';

// UC-003: renders one payroll line per staff member. Amounts arrive as
// NUMERIC(12,2) strings from the API (exact, no float maths anywhere) and
// are formatted into dollars only HERE, at the display edge.
export function formatMoney(value) {
  return Number(value ?? 0).toLocaleString('en-SG', {
    style: 'currency',
    currency: 'SGD',
  });
}

// Route each incomplete reason to the workflow that owns its source data.
// Missing performance data is resolved here; hours belong to UC-002, staff
// details to Staff Management, and pay-rate setup has no dedicated UI yet.
export function getIncompleteAction(line) {
  const codes = new Set((line.incompleteReasons || []).map((reason) => reason.code));
  if (codes.has('MISSING_PERFORMANCE_INPUT')) return 'performance-input';
  if (codes.has('NO_HOURS_RECORDED') || codes.has('INVALID_HOURS')) return 'timesheets';
  if (codes.has('MISSING_DATE_OF_BIRTH')) return 'staff';
  return null;
}

// Reason codes that can be resolved directly from the payroll calc page
// via a resolve dialog (add a note, mark as acceptable).
const RESOLVABLE_VIA_DIALOG = [
  'NO_HOURS_RECORDED',
  'INVALID_HOURS',
  'MISSING_PAY_RATE',
  'MISSING_DATE_OF_BIRTH',
];

function ResolveLineDialog({ open, line, loading, onClose, onSubmit }) {
  const [note, setNote] = useState('');

  React.useEffect(() => {
    if (open) {
      setNote('');
    }
  }, [open, line]);

  if (!open || !line) return null;

  const handleSubmit = () => {
    onSubmit({ note: note.trim() });
  };

  return (
    <div className="resolve-modal-overlay" onClick={loading ? undefined : onClose}>
      <div className="resolve-modal" onClick={(e) => e.stopPropagation()}>
        <div className="resolve-modal-header">
          <h3>Resolve incomplete line</h3>
        </div>
        <div className="resolve-modal-body">
          <p><strong>{line.staffName}</strong> ({line.externalRef})</p>
          <div className="resolve-reasons">
            {(line.incompleteReasons || [])
              .filter((reason) => RESOLVABLE_VIA_DIALOG.includes(reason.code))
              .map((reason, idx) => (
                <div key={idx} className="resolve-reason-item">
                  <span className="badge badge-warning">
                    <span className="badge-dot" />
                    {reason.code.replace(/_/g, ' ')}
                  </span>
                  <p className="resolve-reason-message">{reason.message}</p>
                </div>
              ))}
          </div>
          <div className="field-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <label htmlFor="resolve-note">Resolution note</label>
            <textarea
              id="resolve-note"
              placeholder="Add a note explaining why this is acceptable or what action was taken..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        <div className="resolve-modal-footer">
          <button type="button" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="button" className="primary" onClick={handleSubmit} disabled={loading || !note.trim()}>
            {loading ? 'Resolving…' : 'Resolve'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Column key → the server-side sort key it maps to (runService.LINE_SORTS).
// Columns without an entry simply aren't sortable.
function SortableHeader({ label, sortKey, sort, dir, onSort, numeric }) {
  if (!onSort) return <th className={numeric ? 'numeric' : undefined}>{label}</th>;
  const active = sort === sortKey;
  return (
    <th className={numeric ? 'numeric' : undefined} aria-sort={active ? (dir === 'desc' ? 'descending' : 'ascending') : undefined}>
      <button type="button" className="th-sort" onClick={() => onSort(sortKey)}>
        {label}
        <span className="th-sort-arrow" aria-hidden="true">
          {active ? (dir === 'desc' ? ' ▼' : ' ▲') : ''}
        </span>
      </button>
    </th>
  );
}

function PayrollLineTable({ lines, onResolve, onResolveLine, onReviewTimesheets, onReviewStaff, onShowBreakdown, sort, dir, onSort, filtered, canMutate, onEditLine, onDeleteLine }) {
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolveLine, setResolveLine] = useState(null);
  const [resolveLoading, setResolveLoading] = useState(false);

  const handleOpenResolveDialog = (line) => {
    setResolveLine(line);
    setResolveDialogOpen(true);
  };

  const handleCloseResolveDialog = () => {
    setResolveDialogOpen(false);
    setResolveLine(null);
  };

  const handleSubmitResolveDialog = async ({ note }) => {
    if (!resolveLine || !onResolveLine) return;
    setResolveLoading(true);
    try {
      await onResolveLine(resolveLine, note);
      handleCloseResolveDialog();
    } finally {
      setResolveLoading(false);
    }
  };

  if (!lines || lines.length === 0) {
    return (
      <p className="empty-state">
        {filtered
          ? 'No lines match the current search/filter — clear them to see every staff member.'
          : 'No payroll lines for this period yet — pick a validated period and run the calculation.'}
      </p>
    );
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <SortableHeader label="Staff ID" sortKey="ref" sort={sort} dir={dir} onSort={onSort} />
            <SortableHeader label="Name" sortKey="name" sort={sort} dir={dir} onSort={onSort} />
            <th>Type</th>
            <th className="numeric">Hours Gross</th>
            <th className="numeric">Incentive</th>
            <th className="numeric">Adjustments</th>
            <SortableHeader label="Gross Total" sortKey="gross" sort={sort} dir={dir} onSort={onSort} numeric />
            <th className="numeric">CPF (Employee)</th>
            <th className="numeric">CPF (Employer)</th>
            <th className="numeric">SDL (Employer)</th>
            <SortableHeader label="Net Payable" sortKey="net" sort={sort} dir={dir} onSort={onSort} numeric />
            <SortableHeader label="Status" sortKey="status" sort={sort} dir={dir} onSort={onSort} />
            {onShowBreakdown && <th />}
            {canMutate && <th aria-label="actions" />}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const incompleteAction = getIncompleteAction(line);
            return (
            <tr key={line.id}>
              <td>{line.externalRef}</td>
              <td>{line.staffName}</td>
              <td>{line.employmentType === 'full_time' ? 'Full-time' : 'Part-time'}</td>
              <td className="numeric">{formatMoney(line.grossFromHours)}</td>
              <td className="numeric">{formatMoney(line.incentiveAmount)}</td>
              <td className="numeric">{formatMoney(line.adjustmentsTotal)}</td>
              <td className="numeric">{formatMoney(line.grossTotal)}</td>
              <td className="numeric">
                {line.cpfEligible === false ? (
                  <span className="badge">CPF exempt</span>
                ) : (
                  formatMoney(line.cpfEmployee)
                )}
              </td>
              <td className="numeric">{formatMoney(line.cpfEmployer)}</td>
              <td className="numeric">{formatMoney(line.sdl)}</td>
              <td className="numeric">
                <strong>{formatMoney(line.netPay)}</strong>
              </td>
              <td>
                {line.lineStatus === 'complete' ? (
                  <span className="badge badge-good">
                    <span className="badge-dot" />
                    Complete
                  </span>
                ) : (
                  <span className="badge badge-warning">
                    <span className="badge-dot" />
                    Incomplete
                  </span>
                )}
                {line.lineStatus === 'incomplete' && (line.incompleteReasons || []).map((reason) => (
                  <div key={reason.code} className="line-note">
                    {reason.message}
                  </div>
                ))}
                {line.lineStatus === 'incomplete' && incompleteAction === 'performance-input' && onResolve && (
                    <div>
                      <button type="button" onClick={() => onResolve(line)}>
                        Add Performance Input
                      </button>
                    </div>
                  )}
                {line.lineStatus === 'incomplete' && (
                  (line.incompleteReasons || []).some((reason) => RESOLVABLE_VIA_DIALOG.includes(reason.code)) && onResolveLine && (
                    <div>
                      <button type="button" onClick={() => handleOpenResolveDialog(line)}>
                        Resolve
                      </button>
                    </div>
                  )
                )}
                {line.lineStatus === 'incomplete' && !incompleteAction && !(line.incompleteReasons || []).some((reason) => RESOLVABLE_VIA_DIALOG.includes(reason.code)) && (
                  <div className="line-note">Fix the source payroll data, then recalculate.</div>
                )}
              </td>
              {onShowBreakdown && (
                <td>
                  <button
                    type="button"
                    className="row-action"
                    onClick={() => onShowBreakdown(line)}
                    title="How this line was calculated"
                  >
                    Details
                  </button>
                </td>
              )}
              {canMutate && (
                <td className="numeric">
                  <button type="button" className="row-action" title="Edit" aria-label={`Edit line for ${line.staffName}`} onClick={() => onEditLine(line)}>✎</button>
                  <button type="button" className="row-action" title="Delete" aria-label={`Delete line for ${line.staffName}`} onClick={() => onDeleteLine(line)}>🗑</button>
                </td>
              )}
            </tr>
          );})}
        </tbody>
      </table>
      <ResolveLineDialog
        open={resolveDialogOpen}
        line={resolveLine}
        loading={resolveLoading}
        onClose={handleCloseResolveDialog}
        onSubmit={handleSubmitResolveDialog}
      />
    </div>
  );
}

export default PayrollLineTable;
