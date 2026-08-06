function SyncSummaryCard({ summary }) {
  if (!summary) return null;

  if (!summary.success) {
    return (
      <div className="card">
        <p>{summary.message}</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Sync Summary</h3>
      <p>Staff synced: {summary.staffSynced}</p>
      <p>Total hours: {summary.totalHours}</p>
      <p>Unmatched: {summary.unmatchedCount}</p>
      <p>Invalid time entries: {summary.invalidTimeCount}</p>
      <p>Last synced: {summary.syncedAt}</p>

      {summary.draftTimesheets && summary.draftTimesheets.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Staff</th>
              <th>Total Hours</th>
              <th>Shifts</th>
            </tr>
          </thead>
          <tbody>
            {summary.draftTimesheets.map((staff) => (
              <tr key={staff.staffId}>
                <td>{staff.fullName} ({staff.staffId})</td>
                <td>{staff.totalHours}</td>
                <td>
                  {staff.shifts.map((shift, i) => (
                    <div key={i}>
                      {shift.date}: {shift.clockIn}–{shift.clockOut} ({shift.hours}h, matched by {shift.matchedBy})
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default SyncSummaryCard;