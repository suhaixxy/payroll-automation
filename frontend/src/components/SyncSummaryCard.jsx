import React from 'react';

// Shows the sync summary as a row of stat tiles, e.g. "47 staff synced, 312 total hours".
function SyncSummaryCard({ summary }) {
  if (!summary) return null;

  const lastSynced = summary.syncedAt ? new Date(summary.syncedAt).toLocaleString() : '—';
  const hasUnmatched = summary.unmatchedCount > 0;

  return (
    <div className="stat-grid">
      <div className="stat-tile">
        <p className="stat-label">Staff Synced</p>
        <p className="stat-value">{summary.staffSynced}</p>
      </div>
      <div className="stat-tile">
        <p className="stat-label">Total Hours</p>
        <p className="stat-value">{summary.totalHours}</p>
      </div>
      <div className="stat-tile">
        <p className="stat-label">Unmatched</p>
        <p className={`stat-value${hasUnmatched ? ' stat-warning' : ''}`}>{summary.unmatchedCount}</p>
      </div>
      <div className="stat-tile">
        <p className="stat-label">Last Synced</p>
        <p className="stat-value stat-value-time">{lastSynced}</p>
      </div>
    </div>
  );
}

export default SyncSummaryCard;
