function SyncHistoryList({ history }) {
  if (!history?.length) return <p className="roster-empty">No sync history yet for this pay period.</p>;

  return (
    <ul className="roster-history-list">
      {history.map((entry, index) => {
        const failed = entry.action === "roster_sync_failed";
        const actor = entry.actor === "scheduler" ? "Automatic" : "Manual (Import Now)";
        return (
          <li key={`${entry.createdAt}-${index}`} className={failed ? "roster-critical" : "roster-synced"}>
            <span>{failed ? "Failed" : "Synced"}</span>
            <strong>{actor}</strong>
            <small>{failed ? entry.detail?.reason : `${entry.detail?.staffSynced ?? 0} staff, ${entry.detail?.totalHours ?? 0}h`}</small>
            <time>{new Date(entry.createdAt).toLocaleString()}</time>
          </li>
        );
      })}
    </ul>
  );
}

export default SyncHistoryList;
