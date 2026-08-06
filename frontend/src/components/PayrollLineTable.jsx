import React from 'react';

// UC-003: renders one payroll line per staff member. Amounts arrive as
// NUMERIC(12,2) strings from the API (exact, no float maths anywhere) and
// are formatted into dollars only HERE, at the display edge.
export function formatMoney(value) {
  return Number(value ?? 0).toLocaleString('en-SG', {
    style: 'currency',
    currency: 'SGD',
  });
}

// Reason codes the UI can act on today: a missing performance input is
// resolved right here via the Resolve button (§5.8). MISSING_PAY_RATE waits
// on the pay-rate ownership decision (§3.3); the hours codes are UC-002's.
const RESOLVABLE = ['MISSING_PERFORMANCE_INPUT'];

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

function PayrollLineTable({ lines, onResolve, onShowBreakdown, sort, dir, onSort, filtered }) {
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
            <th>Staff ID</th>
            <SortableHeader label="Name" sortKey="name" sort={sort} dir={dir} onSort={onSort} />
            <th>Type</th>
            <th className="numeric">Hours Gross</th>
            <th className="numeric">Incentive</th>
            <SortableHeader label="Gross Total" sortKey="gross" sort={sort} dir={dir} onSort={onSort} numeric />
            <th className="numeric">CPF (Employee)</th>
            <th className="numeric">CPF (Employer)</th>
            <th className="numeric">SDL (Employer)</th>
            <SortableHeader label="Net Payable" sortKey="net" sort={sort} dir={dir} onSort={onSort} numeric />
            <SortableHeader label="Status" sortKey="status" sort={sort} dir={dir} onSort={onSort} />
            {onShowBreakdown && <th />}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td>{line.externalRef}</td>
              <td>{line.staffName}</td>
              <td>{line.employmentType === 'full_time' ? 'Full-time' : 'Part-time'}</td>
              <td className="numeric">{formatMoney(line.grossFromHours)}</td>
              <td className="numeric">{formatMoney(line.incentiveAmount)}</td>
              <td className="numeric">{formatMoney(line.grossTotal)}</td>
              <td className="numeric">
                {line.cpfEligible === false ? (
                  // Correct behaviour for e.g. work-pass holders (guide §5.5)
                  // — badged so a $0 here isn't mistaken for a bug.
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
                {(line.incompleteReasons || []).map((reason) => (
                  <div key={reason.code} className="line-note">
                    {reason.message}
                  </div>
                ))}
                {onResolve &&
                  line.lineStatus === 'incomplete' &&
                  (line.incompleteReasons || []).some((reason) => RESOLVABLE.includes(reason.code)) && (
                    <div>
                      <button type="button" onClick={() => onResolve(line)}>
                        Resolve
                      </button>
                    </div>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PayrollLineTable;
