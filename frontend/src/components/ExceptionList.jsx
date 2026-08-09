import { useState } from "react";
import { CheckCircleRounded, LinkRounded, SaveRounded, WarningAmberRounded } from "@mui/icons-material";
import { Alert, Box, Button, Chip, FormControl, InputLabel, MenuItem, Select, TextField, Typography } from "@mui/material";
import { resolveException } from "../api/roster";

function ExceptionList({ items, variant = "unmatched", activeStaff = [], onResolved }) {
  const invalidTime = variant === "invalidTime";
  const [staffSelections, setStaffSelections] = useState({});
  const [timeValues, setTimeValues] = useState({});
  const [resolvingId, setResolvingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  if (!items?.length) {
    return <Alert severity="info">{invalidTime ? "No data issues found." : "No unmatched entries found."}</Alert>;
  }

  const resolve = async (entry, resolution) => {
    setResolvingId(entry.id);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await resolveException(entry.id, resolution);
      const staffName = activeStaff.find((staff) => staff.id === resolution.staffId)?.fullName;
      const message = resolution.ignore ? "Entry ignored" : resolution.staffId ? `Linked to ${staffName || "staff member"}` : "Clock times saved";
      setSuccessMessage(message);
      await onResolved?.(message);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setResolvingId(null);
    }
  };

  const confirmIgnore = (entry) => {
    if (window.confirm("Ignore this entry? You can undo it later from the Resolved section below.")) resolve(entry, { ignore: true });
  };

  return (
    <Box className="roster-sync-exception-list">
      {items.map((entry, index) => {
        const times = timeValues[entry.id] || { clockIn: entry.clockIn || "", clockOut: entry.clockOut || "" };
        const isResolving = resolvingId === entry.id;
        return (
          <Box key={entry.id || `${entry.rosterRawName}-${entry.date}-${index}`} className="roster-sync-exception-row">
            <Box className="roster-sync-exception-info">
              <Chip size="small" color={invalidTime ? "error" : "warning"} icon={<WarningAmberRounded />} label={invalidTime ? "Data issue" : "Unmatched"} />
              <Box>
                <Typography className="roster-sync-exception-name">{entry.rosterRawName}</Typography>
                <Typography className="roster-sync-exception-meta">{entry.date}{invalidTime ? "" : ` · ${entry.hours}h`}</Typography>
              </Box>
            </Box>

            <Box className="roster-sync-exception-controls">
              {!invalidTime && (
                <FormControl size="small" className="roster-sync-exception-select" sx={{ minWidth: 200 }}>
                  <InputLabel id={`link-staff-label-${entry.id}`}>Select active staff</InputLabel>
                  <Select
                    labelId={`link-staff-label-${entry.id}`}
                    label="Select active staff"
                    value={staffSelections[entry.id] || ""}
                    onChange={(event) => setStaffSelections((current) => ({ ...current, [entry.id]: event.target.value }))}
                    disabled={isResolving}
                  >
                    <MenuItem value=""><em>Select active staff</em></MenuItem>
                    {activeStaff.map((staff) => <MenuItem key={staff.id} value={staff.id}>{staff.fullName}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
              {invalidTime && (
                <>
                  <TextField
                    size="small"
                    type="time"
                    label="Clock in"
                    value={times.clockIn}
                    onChange={(event) => setTimeValues((current) => ({ ...current, [entry.id]: { ...times, clockIn: event.target.value } }))}
                    disabled={isResolving}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    size="small"
                    type="time"
                    label="Clock out"
                    value={times.clockOut}
                    onChange={(event) => setTimeValues((current) => ({ ...current, [entry.id]: { ...times, clockOut: event.target.value } }))}
                    disabled={isResolving}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </>
              )}
              <Box className="roster-sync-exception-actions">
                {!invalidTime && (
                  <Button size="small" variant="contained" startIcon={<LinkRounded />} onClick={() => resolve(entry, { staffId: staffSelections[entry.id] })} disabled={isResolving || !entry.id || !staffSelections[entry.id]}>
                    Link
                  </Button>
                )}
                {invalidTime && (
                  <Button size="small" variant="contained" startIcon={<SaveRounded />} onClick={() => resolve(entry, times)} disabled={isResolving || !entry.id || !times.clockIn || !times.clockOut}>
                    Save
                  </Button>
                )}
                <Button size="small" variant="outlined" color="inherit" onClick={() => confirmIgnore(entry)} disabled={isResolving || !entry.id}>
                  Ignore
                </Button>
              </Box>
            </Box>
          </Box>
        );
      })}
      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
      {successMessage && <Alert severity="success" icon={<CheckCircleRounded fontSize="inherit" />}>{successMessage}</Alert>}
    </Box>
  );
}

export default ExceptionList;
