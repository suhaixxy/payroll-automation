// ValidateTimesheetsPage.jsx
//
// UC-002 - Validate & Consolidate Timesheets
// rebuilt to actually use MUI (like the rest of the app does) instead of
// plain css. pulls colors/spacing from the shared theme.js automatically
// just by using MUI components - dont need to hardcode colors here at all,
// which is the whole point of using a theme

import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Chip,
  TextField,
  Checkbox,
  FormControlLabel,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Collapse,
  IconButton,
  Alert,
  Stack,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { getErrorMessage, formatDateTime, formatStatus } from "../utils";

// NOTE: assuming a plain axios import works here same as utils.js does its
// own thing with dayjs etc. if the rest of the app actually uses a shared
// axios instance (like an api.js with baseURL + auth token already set up),
// swap this import for that instead - i dont have that file so cant be sure

// turns our internal status strings into the right MUI chip color,
// matches the palette already defined in theme.js (success/warning/error)
function statusToChipColor(status) {
  if (status === "Matched" || status === "Validated") return "success";
  if (status === "Flagged") return "warning";
  if (status === "Escalated") return "error";
  return "default";
}

function StaffRow({ staff, onReview, actingOnFlag, setActingOnFlag, correctedHours, setCorrectedHours, notes, setNotes, onResolve, onEscalate }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow hover onClick={() => setOpen((v) => !v)} sx={{ cursor: "pointer", "& > *": { borderBottom: "unset" } }}>
        <TableCell>
          <IconButton size="small">
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell>{staff.staffId}</TableCell>
        <TableCell>{staff.name}</TableCell>
        <TableCell>
          <Chip size="small" label={staff.status} color={statusToChipColor(staff.status)} />
        </TableCell>
        <TableCell>{staff.totalHours}</TableCell>
        <TableCell>{staff.flags.length}</TableCell>
      </TableRow>

      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Actual Hours</TableCell>
                    <TableCell>Issue</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {staff.entries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Typography variant="body2" color="text.secondary">
                          No timesheet entries found for this staff member this period.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {staff.entries.map((entry) => {
                    const flag = staff.flags.find((f) => f.entryId === entry.id);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date}</TableCell>
                        <TableCell>{entry.actualHours}</TableCell>
                        <TableCell> 
                          {flag ? (
                            <Chip size="small" label={flag.label} color="warning" variant="outlined" />
                          ) : (
                            <Typography variant="caption" color="text.secondary">OK</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {flag && flag.status === "OPEN" && actingOnFlag !== flag.id && (
                            <Button size="small" onClick={() => onReview(flag.id)}>Review</Button>
                          )}
                          {flag && flag.status !== "OPEN" && (
                            <Chip size="small" label={formatStatus(flag.status)} color={flag.status === "RESOLVED" ? "success" : "error"} />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {/* flags that arent tied to one specific entry - eg missing entry, weekly overtime */}
                  {staff.flags.filter((f) => !staff.entries.some((e) => e.id === f.entryId)).map((flag) => (
                    <TableRow key={flag.id}>
                      <TableCell>—</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell><Chip size="small" label={flag.label} color="warning" variant="outlined" /></TableCell>
                      <TableCell align="right">
                        {flag.status === "OPEN" && actingOnFlag !== flag.id && (
                          <Button size="small" onClick={() => onReview(flag.id)}>Review</Button>
                        )}
                        {flag.status !== "OPEN" && (
                          <Chip size="small" label={formatStatus(flag.status)} color={flag.status === "RESOLVED" ? "success" : "error"} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* resolve panel - shows up once you click Review on a flag */}
              {actingOnFlag && staff.flags.some((f) => f.id === actingOnFlag) && (
                <Card variant="outlined" sx={{ mt: 2, p: 2, maxWidth: 420 }}>
                  <Stack spacing={1.5}>
                    <TextField
                      size="small"
                      label="Corrected hours (if applicable)"
                      value={correctedHours}
                      onChange={(e) => setCorrectedHours(e.target.value)}
                    />
                    <TextField
                      size="small"
                      label="Notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Button size="small" variant="contained" onClick={() => onResolve(actingOnFlag, "CONFIRMED")}>Confirm hours</Button>
                      <Button size="small" variant="outlined" onClick={() => onResolve(actingOnFlag, "CORRECTED")}>Save correction</Button>
                      <Button size="small" color="error" variant="outlined" onClick={() => onEscalate(actingOnFlag)}>Escalate to Director</Button>
                      <Button size="small" onClick={() => setActingOnFlag(null)}>Cancel</Button>
                    </Stack>
                  </Stack>
                </Card>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function ValidateTimesheetsPage() {
  const [payPeriods, setPayPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [data, setData] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const [actingOnFlag, setActingOnFlag] = useState(null);
  const [correctedHours, setCorrectedHours] = useState("");
  const [notes, setNotes] = useState("");

  const [searchText, setSearchText] = useState("");
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  // grab the pay periods for the dropdown
  const loadPeriods = useCallback(async () => {
    try {
      const res = await axios.get("/api/pay-periods");
      setPayPeriods(res.data);
      if (res.data.length && !selectedPeriod) {
        const current = res.data.find((p) => p.current) || res.data[0];
        setSelectedPeriod(current.id);
      }
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // grab the actual review data for whichever period is selected
  const loadReview = useCallback(async () => {
    if (!selectedPeriod) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await axios.get(`/api/validation/${selectedPeriod}/review`);
      setData(res.data);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => { loadPeriods(); }, [loadPeriods]);
  useEffect(() => { loadReview(); }, [loadReview]);

  async function runValidation() {
    try {
      await axios.post(`/api/validation/${selectedPeriod}/run`);
      loadReview();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  }

  async function resolveFlag(flagId, resolution) {
    try {
      await axios.post(`/api/validation/flags/${flagId}/resolve`, {
        resolution,
        correctedHours: correctedHours ? Number(correctedHours) : undefined,
        notes,
      });
      setActingOnFlag(null);
      setCorrectedHours("");
      setNotes("");
      loadReview();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  }

  async function escalateFlag(flagId) {
    try {
      await axios.post(`/api/validation/flags/${flagId}/escalate`, { notes });
      setActingOnFlag(null);
      setNotes("");
      loadReview();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  }

  async function bulkResolve(flagType) {
    try {
      await axios.post(`/api/validation/${selectedPeriod}/bulk-resolve`, { flagType });
      loadReview();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  }

  async function markValidated() {
    try {
      await axios.post(`/api/validation/${selectedPeriod}/mark-validated`);
      loadReview();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  }

  async function toggleAuditLog() {
    if (!showAuditLog) {
      try {
        const res = await axios.get(`/api/validation/${selectedPeriod}/audit-log`);
        setAuditLog(res.data.entries || []);
      } catch (err) {
        setErrorMsg(getErrorMessage(err));
      }
    }
    setShowAuditLog((v) => !v);
  }

  const staffList = data?.staff || [];

  // work out which flag types have 2+ open flags, so we know which bulk
  // resolve buttons are worth showing
  const bulkCandidates = useMemo(() => {
    const counts = {};
    for (const s of staffList) {
      for (const f of s.flags || []) {
        if (f.status === "OPEN") counts[f.flagType] = (counts[f.flagType] || 0) + 1;
      }
    }
    return Object.entries(counts).filter(([, count]) => count >= 2);
  }, [staffList]);

  const visibleStaff = useMemo(() => {
    return staffList.filter((s) => {
      if (onlyFlagged && s.status !== "Flagged" && s.status !== "Escalated") return false;
      if (searchText.trim()) {
        const q = searchText.trim().toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !s.staffId.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [staffList, searchText, onlyFlagged]);

  const blockingCount = staffList.reduce(
    (n, s) => n + (s.flags || []).filter((f) => f.status === "OPEN" || f.status === "ESCALATED").length,
    0
  );
  const totalHoursValidated = staffList.reduce((sum, s) => sum + s.totalHours, 0);

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Typography variant="h1" gutterBottom>Validate Timesheets</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 720, mb: 3 }}>
        Cross-checks each staff member's captured hours against their approved roster for the selected
        pay period, flags anomalies — overtime, missing entries, duplicate records — and consolidates
        confirmed hours into a validated timesheet ready for payroll calculation.
      </Typography>

      {errorMsg && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      )}

      <FormControl size="small" sx={{ minWidth: 260, mb: 2 }}>
        <InputLabel>Pay Period</InputLabel>
        <Select
          label="Pay Period"
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
        >
          {payPeriods.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.start_date} – {p.end_date}{p.current ? " (current)" : ""}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Stack direction="row" spacing={1.5} sx={{ mb: 3 }}>
        <Button variant="contained" onClick={runValidation}>Run Validation</Button>
        <Button
          variant="outlined"
          onClick={markValidated}
          disabled={blockingCount > 0 || data?.status === "VALIDATED"}
        >
          {data?.status === "VALIDATED" ? "Validated ✓" : "Mark Period Validated"}
        </Button>
        <Button variant="text" onClick={toggleAuditLog}>
          {showAuditLog ? "Hide History" : "View History"}
        </Button>
      </Stack>

      {showAuditLog && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h3" gutterBottom>Activity History</Typography>
            {auditLog.length === 0 && (
              <Typography variant="body2" color="text.secondary">Nothing has happened yet.</Typography>
            )}
            {auditLog.map((entry) => (
              <Box key={entry.id} sx={{ py: 1, borderBottom: "1px dashed", borderColor: "divider" }}>
                <Typography variant="body2">
                  <strong>{entry.action}</strong> — {entry.details}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDateTime(entry.created_at)}
                </Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      {/* stat cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2, mb: 3 }}>
        <Card>
          <CardContent>
            <Typography variant="caption" color="text.secondary">STAFF REVIEWED</Typography>
            <Typography variant="h2">{staffList.length}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="caption" color="text.secondary">TOTAL HOURS VALIDATED</Typography>
            <Typography variant="h2">{totalHoursValidated}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="caption" color="text.secondary">DISCREPANCIES FLAGGED</Typography>
            <Typography variant="h2" color={blockingCount > 0 ? "warning.main" : "text.primary"}>{blockingCount}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="caption" color="text.secondary">LAST VALIDATED</Typography>
            <Typography variant="body1">{formatDateTime(data?.lastValidatedAt)}</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* bulk resolve suggestions */}
      {bulkCandidates.length > 0 && (
        <Card variant="outlined" sx={{ mb: 3, backgroundColor: "action.hover" }}>
          <CardContent>
            <Typography variant="body2" fontWeight={600} gutterBottom>Bulk actions available:</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {bulkCandidates.map(([flagType, count]) => (
                <Button key={flagType} size="small" variant="outlined" onClick={() => bulkResolve(flagType)}>
                  Confirm all {formatStatus(flagType).toLowerCase()} flags ({count})
                </Button>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* main table */}
      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h3">Discrepancy Review</Typography>
            <Typography variant="body2" color="text.secondary">
              {visibleStaff.length} of {staffList.length} staff
            </Typography>
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <TextField
              size="small"
              label="Search by name or staff ID"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              sx={{ minWidth: 260 }}
            />
            <FormControlLabel
              control={<Checkbox checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} />}
              label="Only show flagged"
            />
          </Stack>

          {loading && <Typography color="text.secondary">Loading…</Typography>}
          {!loading && visibleStaff.length === 0 && (
            <Typography color="text.secondary">No staff match your search/filter.</Typography>
          )}

          {!loading && visibleStaff.length > 0 && (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell />
                    <TableCell>Staff ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Total Hours</TableCell>
                    <TableCell>Flags</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleStaff.map((staff) => (
                    <StaffRow
                      key={staff.staffId}
                      staff={staff}
                      onReview={setActingOnFlag}
                      actingOnFlag={actingOnFlag}
                      setActingOnFlag={setActingOnFlag}
                      correctedHours={correctedHours}
                      setCorrectedHours={setCorrectedHours}
                      notes={notes}
                      setNotes={setNotes}
                      onResolve={resolveFlag}
                      onEscalate={escalateFlag}
                    />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
