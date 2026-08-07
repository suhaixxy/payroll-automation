function ExceptionList({ items, variant = "unmatched" }) {
  const invalidTime = variant === "invalidTime";
  if (!items?.length) {
    return <p className="roster-empty">{invalidTime ? "No data issues found." : "No unmatched entries found."}</p>;
  }

  return (
    <ul className="roster-exception-list">
      {items.map((entry, index) => (
        <li key={`${entry.rosterRawName}-${entry.date}-${index}`} className={invalidTime ? "roster-critical" : "roster-unmatched"}>
          <span>{invalidTime ? "Data issue" : "Unmatched"}</span>
          <strong>{entry.rosterRawName}</strong>
          <small>{entry.date}{invalidTime ? "" : ` · ${entry.hours}h`}</small>
        </li>
      ))}
    </ul>
  );
}

export default ExceptionList;
