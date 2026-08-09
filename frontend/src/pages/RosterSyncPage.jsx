import { Fragment, useEffect, useState } from "react";
import {
  CheckCircleRounded,
  CloudOffRounded,
  ErrorRounded,
  ExpandLessRounded,
  ExpandMoreRounded,
  LockRounded,
  RestartAltRounded,
  SyncRounded,
  UndoRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { fetchPayPeriods, fetchResolvedExceptions, fetchSourceHealth, fetchSyncHistory, fetchSyncSummary, resetPeriodResolutions, simulateSheetDown, triggerImportNow, undoException } from "../api/roster";
import { getStaff } from "../api/staff";
import ExceptionList from "../components/ExceptionList";
import SyncHistoryList from "../components/SyncHistoryList";
import SyncSummaryCard from "../components/SyncSummaryCard";
import { PageHeader } from "../components/CommonComponents";
import "../styles/rosterSync.css";

const resolutionLabels = { staff_linked: "Matched", clock_times_updated: "Fixed", ignored: "Ignored" };
const resolutionColors = { staff_linked: "success", clock_times_updated: "info", ignored: "default" };
const resolutionDescriptions = { staff_linked: "Linked to staff", clock_times_updated: "Clock times fixed", ignored: "Ignored" };

function RosterSyncPage() {
  const [payPeriods, setPayPeriods] = useState([]);
  const [activeStaff, setActiveStaff] = useState([]);
  const [selectedPayPeriodId, setSelectedPayPeriodId] = useState("");
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [resolvedExceptions, setResolvedExceptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [resolutionMessage, setResolutionMessage] = useState("");
  const [preservedDraft, setPreservedDraft] = useState(false);
  const [expandedStaffId, setExpandedStaffId] = useState(null);
  const [sourceHealth, setSourceHealth] = useState(null);
  const today = new Date();
  const windowStart = new Date(today);
  const windowEnd = new Date(today);
  windowStart.setMonth(windowStart.getMonth() - 3);
  windowEnd.setMonth(windowEnd.getMonth() + 3);
  const visiblePayPeriods = payPeriods.filter((period) => {
    const startDate = new Date(`${period.startDate}T00:00:00`);
    const endDate = new Date(`${period.endDate}T23:59:59`);
    return endDate >= windowStart && startDate <= windowEnd;
  });

  async function refresh(payPeriodId) {
    const [nextSummary, nextHistory, nextResolvedExceptions] = await Promise.all([fetchSyncSummary(payPeriodId), fetchSyncHistory(payPeriodId), fetchResolvedExceptions(payPeriodId)]);
    setSummary(nextSummary);
    setHistory(nextHistory.history);
    setResolvedExceptions(nextResolvedExceptions.resolvedExceptions);
  }

  async function refreshAfterResolution(message) {
    setResolutionMessage(message);
    await refresh(selectedPayPeriodId);
  }

  useEffect(() => {
    Promise.all([fetchPayPeriods(), getStaff("active")]).then(([periods, staff]) => {
      setPayPeriods(periods);
      setActiveStaff(staff);
      const selected = periods.reduce((mostRecent, period) => (
        !period.lastSyncedAt || (mostRecent && new Date(period.lastSyncedAt) <= new Date(mostRecent.lastSyncedAt))
          ? mostRecent
          : period
      ), null) || periods.find((period) => period.isActive) || periods[0];
      if (selected) {
        setSelectedPayPeriodId(selected.id);
        refresh(selected.id).catch((error) => setErrorMessage(error.message));
      }
    }).catch((error) => setErrorMessage(error.message));
  }, []);

  useEffect(() => {
    fetchSourceHealth()
      .then(setSourceHealth)
      .catch(() => setSourceHealth(null));
  }, []);

  async function applyResult(result) {
    if (!result.success) {
      setErrorMessage(result.message);
      if (result.previousDraft) {
        setSummary(result.previousDraft);
        setPreservedDraft(true);
      }
    } else {
      setSummary(result);
      setPreservedDraft(false);
    }
    const [nextHistory, nextResolvedExceptions] = await Promise.all([fetchSyncHistory(selectedPayPeriodId), fetchResolvedExceptions(selectedPayPeriodId)]);
    setHistory(nextHistory.history);
    setResolvedExceptions(nextResolvedExceptions.resolvedExceptions);
  }

  async function runImport(action) {
    if (!selectedPayPeriodId) return;
    setLoading(true);
    setErrorMessage("");
    setPreservedDraft(false);
    try {
      await applyResult(await action(selectedPayPeriodId));
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function undoResolvedException(timesheetRowId) {
    setLoading(true);
    setErrorMessage("");
    try {
      await undoException(timesheetRowId);
      await refresh(selectedPayPeriodId);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function resetResolutions() {
    if (!window.confirm("This will undo ALL manual fixes for this period and re-sync fresh from the sheet. Continue?")) return;
    setLoading(true);
    setErrorMessage("");
    setPreservedDraft(false);
    try {
      await resetPeriodResolutions(selectedPayPeriodId);
      await refresh(selectedPayPeriodId);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box className="page-enter content-page roster-sync-page">
      <PageHeader title="UC-001: Roster Sync" subtitle="Import roster shifts, match staff, and maintain draft timesheets for the selected pay period." />

      <Card className="roster-sync-control-card">
        <CardContent>
          {sourceHealth && (
            <Box className="roster-sync-health-row" aria-label="Roster source health">
              <Chip
                icon={sourceHealth.database === "connected" ? <CheckCircleRounded /> : <ErrorRounded />}
                color={sourceHealth.database === "connected" ? "success" : "error"}
                label={`Database: ${sourceHealth.database === "connected" ? "Connected" : "Disconnected"}`}
              />
              <Chip
                icon={sourceHealth.googleSheet === "connected" ? <CheckCircleRounded /> : <ErrorRounded />}
                color={sourceHealth.googleSheet === "connected" ? "success" : "error"}
                label={`Google Sheet: ${sourceHealth.googleSheet === "connected" ? "Connected" : "Disconnected"}`}
              />
            </Box>
          )}

          <Box className="roster-sync-toolbar">
            <FormControl size="small" className="roster-sync-period-select" disabled={loading}>
              <InputLabel id="roster-pay-period-label">Pay period</InputLabel>
              <Select
                labelId="roster-pay-period-label"
                label="Pay period"
                value={selectedPayPeriodId}
                onChange={(event) => { setSelectedPayPeriodId(event.target.value); setExpandedStaffId(null); refresh(event.target.value).catch((error) => setErrorMessage(error.message)); }}
              >
                {visiblePayPeriods.map((period) => (
                  <MenuItem key={period.id} value={period.id} disabled={period.isLocked}>
                    <Box className="roster-sync-period-option">
                      <span>{period.startDate} to {period.endDate}{period.isActive ? " (active)" : ""}</span>
                      {period.isLocked && <Box component="span" className="roster-sync-locked-badge"><LockRounded fontSize="inherit" />Locked</Box>}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box className="roster-sync-actions">
              <Button variant="contained" startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SyncRounded />} onClick={() => runImport(triggerImportNow)} disabled={loading || !selectedPayPeriodId}>
                {loading ? "Syncing…" : "Import Now"}
              </Button>
              <Button variant="outlined" startIcon={<CloudOffRounded />} onClick={() => runImport(simulateSheetDown)} disabled={loading || !selectedPayPeriodId}>Simulate Sheet Down</Button>
              <Button variant="outlined" color="inherit" startIcon={<RestartAltRounded />} onClick={resetResolutions} disabled={loading || !selectedPayPeriodId}>Reset Period</Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {errorMessage && <Alert severity="error" className="roster-sync-alert">{errorMessage}</Alert>}
      {resolutionMessage && <Alert severity="success" className="roster-sync-alert" onClose={() => setResolutionMessage("")}>{resolutionMessage}</Alert>}
      {preservedDraft && <Alert severity="info" className="roster-sync-alert">Last synced draft preserved; the live import could not complete.</Alert>}

      {summary
        ? <SyncSummaryCard summary={summary} />
        : !loading && <Alert severity="info" className="roster-sync-alert">No sync has been run yet for this pay period. Click Import Now to get started.</Alert>}

      <Card className="roster-sync-section-card">
        <CardContent>
          <Typography component="h2">Draft Timesheet Totals</Typography>
          {summary?.draftTimesheets?.length ? (
            <TableContainer className="roster-sync-draft-table">
              <Table aria-label="Draft timesheet totals" className="roster-sync-draft-outer-table">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: "16%" }}>Staff ID</TableCell>
                    <TableCell sx={{ width: "38%" }}>Name</TableCell>
                    <TableCell align="right" sx={{ width: "23%" }}>Total Hours</TableCell>
                    <TableCell align="right" sx={{ width: "23%" }}>Shifts</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summary.draftTimesheets.map((staff) => {
                    const expanded = expandedStaffId === staff.staffId;
                    return (
                      <Fragment key={staff.staffId}>
                        <TableRow className={`roster-sync-expandable-row${expanded ? " is-expanded" : ""}`} onClick={() => setExpandedStaffId(expanded ? null : staff.staffId)}>
                          <TableCell>{staff.staffId}</TableCell>
                          <TableCell>{staff.fullName}</TableCell>
                          <TableCell align="right">{staff.totalHours}</TableCell>
                          <TableCell align="right">
                            <Box className="roster-sync-shift-count">
                              {staff.shifts.length} shift{staff.shifts.length === 1 ? "" : "s"}
                              <IconButton size="small" aria-label={expanded ? "Collapse shifts" : "Expand shifts"} className="roster-sync-shift-toggle">
                                {expanded ? <ExpandLessRounded fontSize="small" /> : <ExpandMoreRounded fontSize="small" />}
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                        <TableRow className="roster-sync-breakdown-row">
                          <TableCell className="roster-sync-breakdown-cell" colSpan={4}>
                            <Collapse in={expanded} timeout="auto" unmountOnExit>
                              <Box className="roster-sync-breakdown-panel">
                                <Typography className="roster-sync-breakdown-caption">Shift breakdown for {staff.fullName}</Typography>
                                <Table size="small" className="roster-sync-breakdown-table" aria-label={`Shift breakdown for ${staff.fullName}`}>
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>Date</TableCell>
                                      <TableCell>Time</TableCell>
                                      <TableCell align="right">Hours</TableCell>
                                      <TableCell>Matched By</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {staff.shifts.map((shift, index) => (
                                      <TableRow key={`${shift.date}-${index}`}>
                                        <TableCell>{shift.date}</TableCell>
                                        <TableCell>{shift.clockIn}–{shift.clockOut}</TableCell>
                                        <TableCell align="right">{shift.hours}</TableCell>
                                        <TableCell>{shift.matchedBy === "name" ? "Name fallback" : "Staff ID"}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          ) : <Alert severity="info">No draft timesheets yet — run a sync to populate this table.</Alert>}
        </CardContent>
      </Card>

      <Card className="roster-sync-section-card">
        <CardContent>
          <Typography component="h2">Unmatched Entries</Typography>
          <ExceptionList items={summary?.unmatched} activeStaff={activeStaff} onResolved={refreshAfterResolution} />
        </CardContent>
      </Card>

      <Card className="roster-sync-section-card">
        <CardContent>
          <Typography component="h2">Data Issues</Typography>
          <ExceptionList items={summary?.invalidTime} variant="invalidTime" activeStaff={activeStaff} onResolved={refreshAfterResolution} />
        </CardContent>
      </Card>

      <Card className="roster-sync-section-card">
        <CardContent>
          <Typography component="h2">Resolved</Typography>
          {resolvedExceptions.length ? (
            <Box className="roster-sync-resolved-list">
              {resolvedExceptions.map((entry) => (
                <Box key={entry.id} className="roster-sync-resolved-row">
                  <Chip size="small" color={resolutionColors[entry.resolution_type] || "default"} label={resolutionLabels[entry.resolution_type] || entry.resolution_type} />
                  <Box className="roster-sync-resolved-info">
                    <Typography className="roster-sync-resolved-name">{entry.full_name || entry.roster_raw_name || entry.source_key}</Typography>
                    <Typography className="roster-sync-resolved-meta">{entry.shift_date} · {resolutionDescriptions[entry.resolution_type] || entry.resolution_type}</Typography>
                  </Box>
                  <Button size="small" variant="outlined" startIcon={<UndoRounded />} onClick={() => undoResolvedException(entry.id)} disabled={loading} className="roster-sync-undo-button">
                    Undo
                  </Button>
                </Box>
              ))}
            </Box>
          ) : <Alert severity="info">No resolved exceptions for this period.</Alert>}
        </CardContent>
      </Card>

      <Card className="roster-sync-section-card">
        <CardContent>
          <Typography component="h2">Sync History</Typography>
          <SyncHistoryList history={history} />
        </CardContent>
      </Card>
    </Box>
  );
}

export default RosterSyncPage;
