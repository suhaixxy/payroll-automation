function SyncSummaryCard({ summary }) {
  if (!summary || !summary.success) return null;

  const lastSynced = summary.syncedAt ? new Date(summary.syncedAt).toLocaleString() : "—";

  return (
    <div className="roster-stat-grid">
      <div className="roster-stat-tile"><p>Staff synced</p><strong>{summary.staffSynced}</strong></div>
      <div className="roster-stat-tile"><p>Total hours</p><strong>{summary.totalHours}</strong></div>
      <div className="roster-stat-tile"><p>Unmatched</p><strong className={summary.unmatchedCount ? "roster-warning" : ""}>{summary.unmatchedCount}</strong></div>
      <div className="roster-stat-tile"><p>Last synced</p><strong className="roster-time">{lastSynced}</strong></div>
    </div>
  );
}

export default SyncSummaryCard;
