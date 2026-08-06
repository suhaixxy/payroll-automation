function ExceptionList({ unmatched, invalidTime }) {
  const hasUnmatched = unmatched && unmatched.length > 0;
  const hasInvalidTime = invalidTime && invalidTime.length > 0;

  if (!hasUnmatched && !hasInvalidTime) return null;

  return (
    <div className="card">
      <h3>Exceptions</h3>

      {hasUnmatched && (
        <>
          <h4>Unmatched ({unmatched.length})</h4>
          <ul>
            {unmatched.map((row, i) => (
              <li key={i}>
                {row.rosterRawName} — {row.date} ({row.hours}h)
              </li>
            ))}
          </ul>
        </>
      )}

      {hasInvalidTime && (
        <>
          <h4>Invalid Time Entries ({invalidTime.length})</h4>
          <ul>
            {invalidTime.map((row, i) => (
              <li key={i}>
                {row.rosterRawName} — {row.date}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default ExceptionList;
