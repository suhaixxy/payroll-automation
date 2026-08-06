function SyncHistoryList({ history }) {
  if (!history || history.length === 0) {
    return (
      <div className="card">
        <h3>Sync History</h3>
        <p>No sync history yet.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Sync History</h3>
      <ul>
        {history.map((entry, i) => (
          <li key={i}>
            {entry.createdAt} — {entry.action} (by {entry.actor})
            {entry.detail && (
              <div>
                {entry.detail.staffSynced !== undefined && `Staff: ${entry.detail.staffSynced}, `}
                {entry.detail.totalHours !== undefined && `Hours: ${entry.detail.totalHours}, `}
                {entry.detail.unmatchedCount !== undefined && `Unmatched: ${entry.detail.unmatchedCount}, `}
                {entry.detail.invalidTimeCount !== undefined && `Invalid: ${entry.detail.invalidTimeCount}`}
                {entry.detail.reason && `Reason: ${entry.detail.reason}`}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SyncHistoryList;