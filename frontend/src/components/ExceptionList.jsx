import { useState } from "react";
import { resolveException } from "../api/roster";

function ExceptionList({ items, variant = "unmatched", activeStaff = [], onResolved }) {
  const invalidTime = variant === "invalidTime";
  const [staffSelections, setStaffSelections] = useState({});
  const [timeValues, setTimeValues] = useState({});
  const [resolvingId, setResolvingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  if (!items?.length) {
    return <p className="roster-empty">{invalidTime ? "No data issues found." : "No unmatched entries found."}</p>;
  }

  const resolve = async (entry, resolution) => {
    setResolvingId(entry.id);
    setErrorMessage("");
    try {
      await resolveException(entry.id, resolution);
      await onResolved?.();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <ul className="roster-exception-list">
      {items.map((entry, index) => {
        const times = timeValues[entry.id] || { clockIn: "", clockOut: "" };
        const isResolving = resolvingId === entry.id;
        return (
          <li key={entry.id || `${entry.rosterRawName}-${entry.date}-${index}`} className={invalidTime ? "roster-critical" : "roster-unmatched"}>
            <span>{invalidTime ? "Data issue" : "Unmatched"}</span>
            <strong>{entry.rosterRawName}</strong>
            <small>{entry.date}{invalidTime ? "" : ` · ${entry.hours}h`}</small>
            {!invalidTime && <div className="roster-controls">
              <select value={staffSelections[entry.id] || ""} onChange={(event) => setStaffSelections((current) => ({ ...current, [entry.id]: event.target.value }))} disabled={isResolving}>
                <option value="">Select active staff</option>
                {activeStaff.map((staff) => <option key={staff.id} value={staff.id}>{staff.fullName}</option>)}
              </select>
              <button type="button" className="roster-primary" onClick={() => resolve(entry, { staffId: staffSelections[entry.id] })} disabled={isResolving || !entry.id || !staffSelections[entry.id]}>Link</button>
              <button type="button" className="roster-secondary" onClick={() => resolve(entry, { ignore: true })} disabled={isResolving || !entry.id}>Ignore</button>
            </div>}
            {invalidTime && <div className="roster-controls">
              <input type="time" value={times.clockIn} onChange={(event) => setTimeValues((current) => ({ ...current, [entry.id]: { ...times, clockIn: event.target.value } }))} disabled={isResolving} aria-label="Clock in" />
              <input type="time" value={times.clockOut} onChange={(event) => setTimeValues((current) => ({ ...current, [entry.id]: { ...times, clockOut: event.target.value } }))} disabled={isResolving} aria-label="Clock out" />
              <button type="button" className="roster-primary" onClick={() => resolve(entry, times)} disabled={isResolving || !entry.id || !times.clockIn || !times.clockOut}>Save</button>
              <button type="button" className="roster-secondary" onClick={() => resolve(entry, { ignore: true })} disabled={isResolving || !entry.id}>Ignore</button>
            </div>}
          </li>
        );
      })}
      {errorMessage && <li className="roster-critical"><small>{errorMessage}</small></li>}
    </ul>
  );
}

export default ExceptionList;
