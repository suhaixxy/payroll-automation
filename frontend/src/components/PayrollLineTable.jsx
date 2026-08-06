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
            <th className="numeric">Hours Gross</th>
            <th className="numeric">Incentive</th>
            <th className="numeric">Gross Total</th>
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PayrollLineTable;
