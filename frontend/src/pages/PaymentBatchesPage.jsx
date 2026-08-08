import {
  AddRounded,
  AccountBalanceWalletRounded,
  CheckCircleOutlineRounded,
  DownloadRounded,
  GroupsRounded,
  PendingActionsRounded,
  RefreshRounded,
  SearchRounded,
  VisibilityRounded,
  WarningAmberRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { downloadPaymentFile, generatePayment, getEligiblePeriods, getPaymentBatches, getPaymentPreview } from "../api/paymentApi";
import { EmptyState, ErrorState, PageHeader, StatusChip } from "../components/CommonComponents";
import { formatCurrency, formatDateTime, formatPeriod, getErrorCode, getErrorDetails, getErrorMessage, saveBlobResponse, sortByTimestampsNewestFirst, sortPayPeriodsNewestFirst } from "../utils";

const PAGE_SIZE_OPTIONS = [5, 10, 25];
const paymentStatuses = ["", "generated", "hrms_sync_pending", "hrms_sync_failed", "completed", "cancelled"];
const hrmsStatuses = ["", "not_started", "pending", "failed", "completed"];
const sgd = (value) => `S$${new Intl.NumberFormat("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0))}`;

const paymentStatusLabel = (status) => ({
  generated: "Payment Ready",
  completed: "Paid / Completed",
  hrms_sync_failed: "Sync Failed",
}[status] || status?.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()));
const hrmsStatusLabel = (status) => ({
  completed: "HRMS Synced",
  failed: "Sync Failed",
  not_started: "Not Started",
}[status] || paymentStatusLabel(status));

const generationErrorMessage = (error) => {
  const messages = {
    MISSING_BANK_DETAILS: "Payment generation is blocked because one or more employees have missing bank details.",
    INVALID_BANK_DETAILS: "Payment generation is blocked because one or more employees have invalid bank details.",
    PERIOD_NOT_APPROVED: "The selected payroll period has not been approved.",
    PERIOD_NOT_LOCKED: "The selected payroll period is not locked.",
    DUPLICATE_PAYMENT_BATCH: "A payment batch has already been generated for this payroll period.",
    AUTHENTICATION_REQUIRED: "Your session is not authorised to generate payment batches. Please sign in again.",
    INVALID_TOKEN: "Your session has expired. Please sign in again.",
    FORBIDDEN: "You do not have permission to generate payment batches.",
    INTERNAL_SERVER_ERROR: "The server could not generate the payment batch. Please try again.",
  };
  return messages[getErrorCode(error)] || getErrorMessage(error, "Unable to generate the payment batch.");
};

function BatchSummary({ icon, value, label, tone }) {
  return <Box className={`payment-batch-summary is-${tone}`}><Box>{icon}</Box><Box><Typography>{value}</Typography><Typography>{label}</Typography></Box></Box>;
}

export default function PaymentBatchesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [hrmsStatus, setHrmsStatus] = useState("");
  const [creatorId, setCreatorId] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [eligiblePeriods, setEligiblePeriods] = useState([]);
  const [selectedGeneratePeriod, setSelectedGeneratePeriod] = useState("");
  const [preview, setPreview] = useState(null);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getPaymentBatches({ limit: 100 });
      setRows(response.rows || []);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to load payment batches."));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const periodOptions = useMemo(() => sortPayPeriodsNewestFirst(
    [...new Map(rows.filter((batch) => batch.payPeriod).map((batch) => [batch.payPeriod.id, batch.payPeriod])).values()],
  ), [rows]);
  const creatorOptions = useMemo(() => [...new Map(rows.filter((batch) => batch.generatedBy).map((batch) => [batch.generatedBy.id, batch.generatedBy])).values()], [rows]);
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sortByTimestampsNewestFirst(rows.filter((batch) =>
      (!query || [batch.batchReference, batch.hrmsReference, batch.generatedBy?.fullName, batch.payPeriod && formatPeriod(batch.payPeriod.startDate, batch.payPeriod.endDate)].some((value) => String(value || "").toLowerCase().includes(query))) &&
      (periodId === "" || batch.payPeriod?.id === periodId) &&
      (!paymentStatus || batch.status === paymentStatus) &&
      (!hrmsStatus || batch.hrmsSyncStatus === hrmsStatus) &&
      (!creatorId || batch.generatedBy?.id === creatorId)
    ), (batch) => batch.generatedAt);
  }, [rows, search, periodId, paymentStatus, hrmsStatus, creatorId]);
  const visibleRows = filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const counts = {
    all: rows.length,
    pending: rows.filter((batch) => ["generating", "hrms_sync_pending"].includes(batch.status)).length,
    ready: rows.filter((batch) => batch.status === "generated").length,
    completed: rows.filter((batch) => batch.status === "completed").length,
    failed: rows.filter((batch) => batch.status === "hrms_sync_failed" || batch.hrmsSyncStatus === "failed").length,
  };

  const reset = () => {
    setSearch("");
    setPeriodId("");
    setPaymentStatus("");
    setHrmsStatus("");
    setCreatorId("");
    setPage(0);
  };
  const changeFilter = (setter) => (event) => { setter(event.target.value); setPage(0); };
  const download = async (batch) => {
    if (downloadingId) return;
    setDownloadingId(batch.id);
    try {
      const response = await downloadPaymentFile(batch.id);
      const filename = saveBlobResponse(response, `Payroll_${batch.batchReference}.csv`);
      setNotice(`${filename} downloaded.`);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Payment file download failed."));
    } finally {
      setDownloadingId("");
    }
  };
  const openGenerate = async () => {
    setGenerateOpen(true);
    setLoadingPeriods(true);
    setSelectedGeneratePeriod("");
    setPreview(null);
    setGenerateError("");
    try {
      const response = await getEligiblePeriods();
      setEligiblePeriods(sortPayPeriodsNewestFirst(response.rows || []));
    } catch (requestError) {
      setGenerateError(getErrorMessage(requestError, "Unable to load approved and locked payroll periods."));
    } finally {
      setLoadingPeriods(false);
    }
  };
  const closeGenerate = () => {
    if (generating) return;
    setGenerateOpen(false);
    setSelectedGeneratePeriod("");
    setPreview(null);
    setGenerateError("");
  };
  const selectGeneratePeriod = async (event) => {
    const nextPeriodId = event.target.value;
    setSelectedGeneratePeriod(nextPeriodId);
    setPreview(null);
    setGenerateError("");
    if (!nextPeriodId) return;
    setPreviewLoading(true);
    try {
      setPreview(await getPaymentPreview(nextPeriodId));
    } catch (requestError) {
      setGenerateError(generationErrorMessage(requestError));
    } finally {
      setPreviewLoading(false);
    }
  };
  const availableGenerationPeriods = useMemo(
    () => sortPayPeriodsNewestFirst(eligiblePeriods.filter((period) => period.hasActivePaymentBatch !== true)),
    [eligiblePeriods],
  );
  useEffect(() => {
    if (selectedGeneratePeriod && !availableGenerationPeriods.some((period) => period.id === selectedGeneratePeriod)) {
      setSelectedGeneratePeriod("");
      setPreview(null);
      setGenerateError("");
    }
    // eligiblePeriods only change while the modal is open; clearing a now-hidden selection is the intended trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableGenerationPeriods]);
  const selectedPeriod = availableGenerationPeriods.find((period) => period.id === selectedGeneratePeriod);
  const missingBankWarnings = preview?.employees?.filter((employee) => employee.bankValidationStatus !== "ready") || [];
  const canGenerate = Boolean(
    preview?.ready
    && preview.payPeriod?.status === "approved"
    && preview.payPeriod?.isLocked
    && !selectedPeriod?.hasActivePaymentBatch
  );
  const submitGenerate = async () => {
    if (!canGenerate || generating) return;
    setGenerating(true);
    setGenerateError("");
    try {
      const response = await generatePayment(selectedGeneratePeriod);
      setNotice(response.message || "Payment batch generated successfully.");
      setGenerateOpen(false);
      setSelectedGeneratePeriod("");
      setPreview(null);
      await load();
    } catch (requestError) {
      const retainedBatchId = getErrorDetails(requestError).find((detail) => detail?.paymentBatchId)?.paymentBatchId;
      if (getErrorCode(requestError) === "HRMS_SYNC_FAILURE" && retainedBatchId) {
        setNotice(`Payment batch generated, but HRMS synchronisation failed. ${getErrorMessage(requestError)}`);
        setGenerateOpen(false);
        setSelectedGeneratePeriod("");
        setPreview(null);
        reset();
        await load();
      } else {
        setGenerateError(generationErrorMessage(requestError));
      }
    } finally {
      setGenerating(false);
    }
  };

  return <Box className="page-enter content-page payment-batches-page">
    <PageHeader
      title="Payment Batches"
      subtitle="View and manage payment batches. Track processing status, downloads and HRMS sync."
      actions={<Button
        variant="contained"
        startIcon={<AddRounded />}
        onClick={openGenerate}
        disabled={loadingPeriods || generating}
        sx={{ boxShadow: "0 4px 12px rgba(122, 0, 0, .2)", "&:focus-visible": { outline: "3px solid rgba(122, 0, 0, .25)", outlineOffset: 2 } }}
      >Generate Payment Batch</Button>}
    />
    <Card className="payment-batch-filter-card"><CardContent>
      <Box className="payment-batch-filters">
        <Box><Typography>Search</Typography><TextField value={search} onChange={changeFilter(setSearch)} size="small" placeholder="Search batch ID, pay period or notes..." slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> } }} /></Box>
        <Box><Typography>Pay Period</Typography><FormControl size="small"><InputLabel>Select pay period</InputLabel><Select value={periodId} label="Select pay period" onChange={changeFilter(setPeriodId)}><MenuItem value="">All Pay Periods</MenuItem>{periodOptions.map((period) => <MenuItem key={period.id} value={period.id}>{formatPeriod(period.startDate, period.endDate)}</MenuItem>)}</Select></FormControl></Box>
        <Box><Typography>Payment Status</Typography><FormControl size="small"><InputLabel>All Statuses</InputLabel><Select value={paymentStatus} label="All Statuses" onChange={changeFilter(setPaymentStatus)}>{paymentStatuses.map((status) => <MenuItem key={status || "all"} value={status}>{status ? paymentStatusLabel(status) : "All Statuses"}</MenuItem>)}</Select></FormControl></Box>
        <Box><Typography>HRMS Sync Status</Typography><FormControl size="small"><InputLabel>All Sync Statuses</InputLabel><Select value={hrmsStatus} label="All Sync Statuses" onChange={changeFilter(setHrmsStatus)}>{hrmsStatuses.map((status) => <MenuItem key={status || "all"} value={status}>{status ? paymentStatusLabel(status) : "All Sync Statuses"}</MenuItem>)}</Select></FormControl></Box>
        <Box><Typography>Created By</Typography><FormControl size="small"><InputLabel>All Users</InputLabel><Select value={creatorId} label="All Users" onChange={changeFilter(setCreatorId)}><MenuItem value="">All Users</MenuItem>{creatorOptions.map((creator) => <MenuItem key={creator.id} value={creator.id}>{creator.fullName}</MenuItem>)}</Select></FormControl></Box>
        <Tooltip title="Reset filters"><IconButton aria-label="Reset filters" onClick={reset}><RefreshRounded /></IconButton></Tooltip>
      </Box>
      <Box className="payment-batch-summaries">
        <BatchSummary icon={<GroupsRounded />} value={counts.all} label="All Batches" tone="all" />
        <BatchSummary icon={<PendingActionsRounded />} value={counts.pending} label="Pending Approval" tone="pending" />
        <BatchSummary icon={<AccountBalanceWalletRounded />} value={counts.ready} label="Payment Ready" tone="ready" />
        <BatchSummary icon={<CheckCircleOutlineRounded />} value={counts.completed} label="Paid / Completed" tone="completed" />
        <BatchSummary icon={<WarningAmberRounded />} value={counts.failed} label="Sync Failed" tone="failed" />
      </Box>
    </CardContent></Card>

    <Card className="payment-batch-table-card">
      {loading ? <Box className="payment-batch-loading"><CircularProgress /></Box> : error ? <CardContent><ErrorState message={error} onRetry={load} /></CardContent> : !visibleRows.length ? <EmptyState title="No matching payment batches" message="Change the filters or generate a payment batch." /> : <>
        <TableContainer><Table aria-label="Payment batches">
          <TableHead><TableRow><TableCell>Batch ID</TableCell><TableCell>Pay Period</TableCell><TableCell>Generated Date</TableCell><TableCell align="right">Total Employees</TableCell><TableCell align="right">Total Amount</TableCell><TableCell>Payment Status</TableCell><TableCell>HRMS Sync Status</TableCell><TableCell>Created By</TableCell><TableCell align="center">Actions</TableCell></TableRow></TableHead>
          <TableBody>{visibleRows.map((batch) => {
            const downloadable = batch.status !== "cancelled" && Number(batch.employeeCount) > 0;
            return <TableRow key={batch.id}>
              <TableCell className="payment-batch-reference">{batch.batchReference}</TableCell>
              <TableCell>{batch.payPeriod ? formatPeriod(batch.payPeriod.startDate, batch.payPeriod.endDate) : "—"}</TableCell>
              <TableCell>{formatDateTime(batch.generatedAt)}</TableCell>
              <TableCell align="right">{batch.employeeCount}</TableCell>
              <TableCell align="right">{sgd(batch.totalAmount)}</TableCell>
              <TableCell><StatusChip className={batch.status === "generated" ? "payment-ready-chip" : undefined} status={batch.status} label={paymentStatusLabel(batch.status)} /></TableCell>
              <TableCell><StatusChip status={batch.hrmsSyncStatus} label={hrmsStatusLabel(batch.hrmsSyncStatus)} /></TableCell>
              <TableCell>{batch.generatedBy?.fullName || "—"}</TableCell>
              <TableCell align="center"><Box className="payment-batch-actions">
                <Tooltip title={downloadable ? "Download payment file" : "Payment file unavailable"}><span><IconButton aria-label={`Download ${batch.batchReference} payment file`} disabled={!downloadable || downloadingId === batch.id} onClick={() => download(batch)}>{downloadingId === batch.id ? <CircularProgress size={19} /> : <DownloadRounded />}</IconButton></span></Tooltip>
                <Tooltip title="View payment batch details"><IconButton aria-label={`View ${batch.batchReference}`} onClick={() => navigate(`/payments/${batch.id}`)}><VisibilityRounded /></IconButton></Tooltip>
              </Box></TableCell>
            </TableRow>;
          })}</TableBody>
        </Table></TableContainer>
        <TablePagination component="div" count={filteredRows.length} page={page} onPageChange={(_, value) => setPage(value)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={PAGE_SIZE_OPTIONS} />
      </>}
    </Card>
    <Dialog open={generateOpen} onClose={generating ? undefined : closeGenerate} fullWidth maxWidth="sm" aria-labelledby="generate-payment-batch-title">
      <DialogTitle id="generate-payment-batch-title">Generate Payment Batch</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Select an approved and locked payroll period. Amounts shown are the final approved values supplied by the payroll service.
        </Typography>
        {generateError && <Alert severity="error" sx={{ mb: 2 }}>{generateError}</Alert>}
        <FormControl fullWidth disabled={loadingPeriods || previewLoading || generating || !availableGenerationPeriods.length}>
          <InputLabel>Payroll period</InputLabel>
          <Select value={selectedGeneratePeriod} label="Payroll period" onChange={selectGeneratePeriod}>
            <MenuItem value=""><em>Select a payroll period</em></MenuItem>
            {availableGenerationPeriods.map((period) => <MenuItem key={period.id} value={period.id}>
              {formatPeriod(period.startDate, period.endDate)}
            </MenuItem>)}
          </Select>
        </FormControl>
        {loadingPeriods && <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 3 }}><CircularProgress size={22} /><Typography>Loading payroll periods…</Typography></Box>}
        {!loadingPeriods && !eligiblePeriods.length && !generateError && <Alert severity="info" sx={{ mt: 2 }}>No approved and locked payroll periods are currently available.</Alert>}
        {!loadingPeriods && eligiblePeriods.length > 0 && !availableGenerationPeriods.length && !generateError && <Alert severity="info" sx={{ mt: 2 }}>No approved pay periods are available for payment generation.</Alert>}
        {previewLoading && <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 3 }}><CircularProgress size={22} /><Typography>Checking payment readiness…</Typography></Box>}
        {preview && !previewLoading && <Box sx={{ mt: 2.5 }}>
          <Box className="dialog-summary-grid">
            <Typography color="text.secondary">Payroll period</Typography><Typography fontWeight={700}>{formatPeriod(preview.payPeriod.startDate, preview.payPeriod.endDate)}</Typography>
            <Typography color="text.secondary">Employee count</Typography><Typography fontWeight={700}>{preview.employeeCount}</Typography>
            <Typography color="text.secondary">Total payment amount</Typography><Typography fontWeight={700}>{formatCurrency(preview.totalAmount)}</Typography>
            <Typography color="text.secondary">Approved status</Typography><StatusChip status={preview.payPeriod.status} />
            <Typography color="text.secondary">Locked status</Typography><StatusChip status={preview.payPeriod.isLocked ? "ready" : "blocked"} label={preview.payPeriod.isLocked ? "Locked" : "Not locked"} />
            <Typography color="text.secondary">Batch ready</Typography><StatusChip status={preview.ready ? "ready" : "blocked"} label={preview.ready ? "Ready" : "Not ready"} />
          </Box>
          {missingBankWarnings.length > 0 && <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography fontWeight={700}>Bank-detail warnings</Typography>
            {missingBankWarnings.map((employee) => <Typography key={employee.staffId} variant="body2">
              {employee.employeeName} ({employee.employeeReference}): {employee.bankValidationReason || "Bank details are incomplete."}
            </Typography>)}
          </Alert>}
          {!preview.ready && !missingBankWarnings.length && <Alert severity="warning" sx={{ mt: 2 }}>Payment readiness validation did not pass.</Alert>}
        </Box>}
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
        <Button color="inherit" onClick={closeGenerate} disabled={generating}>Cancel</Button>
        <Button
          variant="contained"
          onClick={submitGenerate}
          disabled={!canGenerate || previewLoading || generating}
          startIcon={generating ? <CircularProgress size={17} color="inherit" /> : <AddRounded />}
        >{generating ? "Generating…" : "Generate Payment Batch"}</Button>
      </DialogActions>
    </Dialog>
    <Snackbar open={Boolean(notice)} autoHideDuration={4000} onClose={() => setNotice("")} message={notice} />
  </Box>;
}
