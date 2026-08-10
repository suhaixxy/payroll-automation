import {
  CheckCircleRounded,
  FilterAltRounded,
  HistoryRounded,
  PlayArrowRounded,
  RefreshRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  bulkResolveTimesheetExceptions,
  completeTimesheetValidation,
  getTimesheetAuditLog,
  getTimesheetReview,
  getValidationPeriods,
  resolveTimesheetException,
  runTimesheetValidation,
} from "../api/validationApi";
import { EmptyState, ErrorState, PageHeader } from "../components/CommonComponents";
import {
  ResolveExceptionDialog,
  TimesheetReviewTable,
  ValidationAuditPanel,
  ValidationSummaryGrid,
} from "../components/ValidationComponents";
import { formatPeriod, getErrorMessage, sortPayPeriodsNewestFirst } from "../utils";

export default function TimesheetValidationPage() {
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [resolveItem, setResolveItem] = useState(null);
  const [resolveStaff, setResolveStaff] = useState(null);
  const [auditEntries, setAuditEntries] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const loadPeriods = useCallback(async () => {
    try {
      const response = await getValidationPeriods();
      const sorted = sortPayPeriodsNewestFirst(response.rows || []);
      setPeriods(sorted);
      setSelectedPeriod((current) => current || sorted[0]?.id || "");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to load pay periods."));
    }
  }, []);

  const loadReview = useCallback(async () => {
    if (!selectedPeriod) {
      setReview(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setReview(await getTimesheetReview(selectedPeriod));
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to load timesheet validation data."));
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => { loadPeriods(); }, [loadPeriods]);
  useEffect(() => { loadReview(); }, [loadReview]);

  const runValidation = async () => {
    if (!selectedPeriod) return;
    setWorking(true);
    setError("");
    try {
      const response = await runTimesheetValidation(selectedPeriod);
      setNotice(response.message || "Validation completed.");
      await loadReview();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to run timesheet validation."));
    } finally {
      setWorking(false);
    }
  };

  const saveResolution = async (payload) => {
    if (!resolveItem) return;
    setWorking(true);
    try {
      const response = await resolveTimesheetException(resolveItem.id, payload);
      setNotice(response.message || "Exception updated.");
      setResolveItem(null);
      setResolveStaff(null);
      await loadReview();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to update the exception."));
    } finally {
      setWorking(false);
    }
  };

  const bulkConfirm = async (ruleType) => {
    setWorking(true);
    try {
      const response = await bulkResolveTimesheetExceptions(selectedPeriod, { ruleType });
      setNotice(response.message || "Exceptions confirmed.");
      await loadReview();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to confirm the selected exceptions."));
    } finally {
      setWorking(false);
    }
  };

  const completeValidation = async () => {
    setWorking(true);
    try {
      const response = await completeTimesheetValidation(selectedPeriod);
      setNotice(response.message || "Pay period validated.");
      await loadReview();
      await loadPeriods();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to complete timesheet validation."));
    } finally {
      setWorking(false);
    }
  };

  const toggleHistory = async () => {
    if (!showHistory && selectedPeriod) {
      try {
        const response = await getTimesheetAuditLog(selectedPeriod);
        setAuditEntries(response.entries || []);
      } catch (requestError) {
        setError(getErrorMessage(requestError, "Unable to load validation history."));
        return;
      }
    }
    setShowHistory((current) => !current);
  };

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (review?.staff || []).filter((staff) => {
      if (onlyFlagged && staff.status !== "Flagged") return false;
      if (!query) return true;
      return [staff.name, staff.staffId].some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [review, search, onlyFlagged]);

  const bulkCandidates = useMemo(() => {
    const counts = new Map();
    for (const staff of review?.staff || []) {
      for (const flag of staff.flags || []) {
        if (!["open", "returned"].includes(flag.status)) continue;
        counts.set(flag.flagType, (counts.get(flag.flagType) || 0) + 1);
      }
    }
    return [...counts.entries()].filter(([, count]) => count >= 2);
  }, [review]);

  const selected = periods.find((period) => period.id === selectedPeriod);

  return <Box className="content-page timesheet-validation-page page-enter">
    <PageHeader
      title="Timesheet Validation"
      subtitle="Review roster hours, resolve exceptions and freeze validated timesheets before payroll calculation."
      actions={<Stack direction="row" spacing={1}><Button variant="outlined" startIcon={<RefreshRounded />} onClick={loadReview} disabled={working || !selectedPeriod}>Refresh</Button><Button variant="contained" startIcon={<PlayArrowRounded />} onClick={runValidation} disabled={working || !selectedPeriod}>Run Validation</Button></Stack>}
    />

    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

    <Card className="validation-control-card"><CardContent><Box className="validation-control-row"><FormControl size="small" sx={{ minWidth: 280 }}><InputLabel>Pay Period</InputLabel><Select label="Pay Period" value={selectedPeriod} onChange={(event) => setSelectedPeriod(event.target.value)}>{periods.map((period) => <MenuItem key={period.id} value={period.id}>{formatPeriod(period.startDate, period.endDate)} · {period.status}</MenuItem>)}</Select></FormControl><Box><Typography variant="body2" color="text.secondary">Selected period</Typography><Typography fontWeight={700}>{selected ? formatPeriod(selected.startDate, selected.endDate) : "No period selected"}</Typography></Box></Box></CardContent></Card>

    {loading ? <Card sx={{ mt: 2 }}><CardContent><Typography color="text.secondary">Loading timesheet validation data…</Typography></CardContent></Card> : !selectedPeriod ? <EmptyState title="No pay period available" message="Create or seed a pay period before running UC-002." /> : review ? <>
      <ValidationSummaryGrid review={review} />

      {bulkCandidates.length > 0 && <Alert severity="info" className="validation-bulk-alert"><Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}><Typography sx={{ flex: 1 }}>Repeated exception types can be confirmed together when they share the same business justification.</Typography>{bulkCandidates.map(([ruleType, count]) => <Button key={ruleType} size="small" variant="outlined" onClick={() => bulkConfirm(ruleType)} disabled={working}>Confirm {count} {ruleType.replaceAll("_", " ")}</Button>)}</Stack></Alert>}

      <Card className="validation-table-card"><CardContent className="validation-table-toolbar"><Box><Typography variant="h2">Employee Review</Typography><Typography color="text.secondary">Inspect matched hours and resolve blocking exceptions.</Typography></Box><Box className="validation-filter-row"><TextField size="small" placeholder="Search employee" value={search} onChange={(event) => setSearch(event.target.value)} InputProps={{ startAdornment: <FilterAltRounded fontSize="small" sx={{ mr: 1, color: "text.secondary" }} /> }} /><FormControlLabel control={<Checkbox checked={onlyFlagged} onChange={(event) => setOnlyFlagged(event.target.checked)} />} label="Flagged only" /></Box></CardContent>{error ? <CardContent><ErrorState message={error} onRetry={loadReview} /></CardContent> : <TimesheetReviewTable rows={visibleRows} onResolve={(flag, staff) => { setResolveItem(flag); setResolveStaff(staff); }} />}</Card>

      <Box className="validation-footer-actions"><Button variant="text" startIcon={<HistoryRounded />} onClick={toggleHistory}>{showHistory ? "Hide History" : "View History"}</Button><Button variant="contained" color="success" startIcon={<CheckCircleRounded />} onClick={completeValidation} disabled={working || !review.canValidate || review.status === "validated"}>{review.status === "validated" ? "Period Validated" : "Mark Period Validated"}</Button></Box>

      {review.discrepancyCount > 0 && <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "right", mt: 1 }}>{review.discrepancyCount} blocking exception(s) must be resolved before the period can be validated.</Typography>}
      {showHistory && <ValidationAuditPanel entries={auditEntries} />}
    </> : <EmptyState title="No validation data" message="Run roster sync first, then run timesheet validation." />}

    <ResolveExceptionDialog open={Boolean(resolveItem)} item={resolveItem} staff={resolveStaff} loading={working} onClose={() => { setResolveItem(null); setResolveStaff(null); }} onSubmit={saveResolution} />
    <Snackbar open={Boolean(notice)} autoHideDuration={3500} onClose={() => setNotice("")} message={notice} />
  </Box>;
}
