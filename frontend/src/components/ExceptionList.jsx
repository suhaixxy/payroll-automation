import React from 'react';

// Shows roster rows that need attention — either an unknown/inactive staff
// record (variant="unmatched") or a row whose clock-in/out couldn't be read
// (variant="invalidTime"). Same shape, different problem for accounting
// staff to resolve, so they're kept visually distinct.
function ExceptionList({ items, variant = 'unmatched' }) {
  const isInvalidTime = variant === 'invalidTime';
  const emptyMessage = isInvalidTime
    ? 'No data issues — every roster row had a readable clock-in/clock-out time.'
    : 'No unmatched entries — every roster row matched an active staff record.';

  if (!items || items.length === 0) {
    return <p className="empty-state">{emptyMessage}</p>;
  }

  return (
    <ul className="exception-list">
      {items.map((entry, index) => (
        <li key={index} className={`exception-item${isInvalidTime ? ' exception-item-critical' : ''}`}>
          <span className={`badge ${isInvalidTime ? 'badge-critical' : 'badge-warning'}`}>
            <span className="badge-dot" />
            {isInvalidTime ? 'Data Issue' : 'Unmatched'}
          </span>
          <span className="exception-name">{entry.rosterRawName}</span>
          <span className="exception-meta">{entry.date}{!isInvalidTime ? ` · ${entry.hours}h` : ''}</span>
        </li>
      ))}
    </ul>
  );
}

export default ExceptionList;
