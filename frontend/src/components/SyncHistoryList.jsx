import React from 'react';

// Shows recent sync events for this pay period — both the nightly automatic
// sync and manual "Import Now" runs — so accounting staff can see the
// scheduled sync actually happened, not just the current draft state.
function SyncHistoryList({ history }) {
  if (!history || history.length === 0) {
    return <p className="empty-state">No sync history yet for this pay period.</p>;
  }

  return (
    <ul className="history-list">
      {history.map((entry, index) => {
        const isFailure = entry.action === 'roster_sync_failed';
        const actorLabel = entry.actor === 'scheduler' ? 'Automatic (nightly)' : 'Manual (Import Now)';
        const when = new Date(entry.createdAt).toLocaleString();

        return (
          <li key={index} className="history-item">
            <span className={`badge ${isFailure ? 'badge-critical' : 'badge-good'}`}>
              <span className="badge-dot" />
              {isFailure ? 'Failed' : 'Synced'}
            </span>
            <span className="history-detail">
              {actorLabel}
              {!isFailure && entry.detail && (
                <>
                  {' — '}
                  {entry.detail.staffSynced} staff, {entry.detail.totalHours}h, {entry.detail.unmatchedCount} unmatched
                </>
              )}
              {isFailure && entry.detail && <> — {entry.detail.reason}</>}
            </span>
            <span className="history-time">{when}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default SyncHistoryList;
