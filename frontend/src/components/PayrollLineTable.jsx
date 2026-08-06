import React from 'react';

// UC-003: renders one payroll line per staff member. All money arrives as
// integer cents from the API and is only turned into dollars HERE, at the
// display edge — no float maths ever happens on money values.
export function formatCents(cents) {
  return (cents / 100).toLocaleString('en-SG', {
    style: 'currency',
    currency: 'SGD',
  });
}

function PayrollLineTable({ lines }) {
  if (!lines || lines.length === 0) {
    return (
      <p className="empty-state">
        No payroll lines for this period yet — pick a validated period and run the calculation.
      </p>
    );
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Staff ID</th>
            <th>Name</th>
            <th>Type</th>
            <th className="numeric">Gross</th>
            <th className="numeric">Incentive</th>
            <th className="numeric">CPF (Employee)</th>
            <th className="numeric">CPF (Employer)</th>
            <th className="numeric">SDL (Employer)</th>
            <th className="numeric">Net Payable</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td>{line.externalRef}</td>
              <td>{line.staffName}</td>
              <td>{line.employmentType === 'full_time' ? 'Full-time' : 'Part-time'}</td>
              <td className="numeric">{formatCents(line.grossPayCents)}</td>
              <td className="numeric">{formatCents(line.incentiveCents)}</td>
              <td className="numeric">
                {line.cpfEligible === false ? (
                  // Correct behaviour for e.g. work-pass holders (guide §5.5)
                  // — badged so a $0 here isn't mistaken for a bug.
                  <span className="badge">CPF exempt</span>
                ) : (
                  formatCents(line.cpfEmployeeCents)
                )}
              </td>
              <td className="numeric">{formatCents(line.cpfEmployerCents)}</td>
              <td className="numeric">{formatCents(line.sdlCents)}</td>
              <td className="numeric">
                <strong>{formatCents(line.netPayCents)}</strong>
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
                {line.notes && <div className="line-note">{line.notes}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PayrollLineTable;
