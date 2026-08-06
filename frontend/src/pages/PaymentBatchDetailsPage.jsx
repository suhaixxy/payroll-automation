import { yupResolver } from "@hookform/resolvers/yup";
import {
  ArrowBackRounded,
  CancelRounded,
  ContentCopyRounded,
  DescriptionRounded,
  DownloadRounded,
  GroupsRounded,
  InfoOutlined,
  PaymentsRounded,
  RefreshRounded,
  TaskAltRounded,
  WarningAmberRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as yup from "yup";
import { cancelPaymentBatch, downloadPaymentFile, getPaymentBatch, retryHrms } from "../api/paymentApi";
import { ConfirmDialog, ErrorState, StatusChip } from "../components/CommonComponents";
import { PaymentBatchItemsTable } from "../components/PaymentComponents";
import { formatCurrency, formatDateTime, formatPeriod, getErrorMessage, saveBlobResponse } from "../utils";

const cancellationSchema = yup.object({ reason: yup.string().trim().min(5, "Enter at least 5 characters").max(500).required("Cancellation reason is required") });
const dash = "—";
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
const percent = (value, total) => total ? `${((value / total) * 100).toFixed(value === total ? 0 : 1)}% of batch` : "0% of batch";
const fileSize = (bytes) => Number.isFinite(Number(bytes)) ? `${(Number(bytes) / 1024).toFixed(2)} KB` : dash;

function DetailRow({ label, children }) {
  return <Box className="payment-detail-row"><Typography>{label}</Typography><Typography component="div">{children ?? dash}</Typography></Box>;
}

export default function PaymentBatchDetailsPage() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState("");
  const [notice, setNotice] = useState("");
  const [retryOpen, setRetryOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const { control, handleSubmit, reset, formState: { errors } } = useForm({ resolver: yupResolver(cancellationSchema), defaultValues: { reason: "" } });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setBatch(await getPaymentBatch(batchId));
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to load payment batch."));
    } finally {
      setLoading(false);
    }
  }, [batchId]);
  useEffect(() => { load(); }, [load]);

  const download = async () => {
    if (action) return;
    setAction("download");
    try {
      const response = await downloadPaymentFile(batch.id);
      setNotice(`${saveBlobResponse(response, batch.paymentFile?.fileName || `Payroll_${batch.batchReference}.csv`)} downloaded.`);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Payment file download failed."));
    } finally {
      setAction("");
    }
  };
  const copyChecksum = async () => {
    try {
      await navigator.clipboard.writeText(batch.paymentFile.checksumSha256);
      setNotice("Full SHA-256 checksum copied.");
    } catch {
      setError("Unable to copy the checksum. Please copy it manually.");
    }
  };
  const retry = async () => {
    setAction("retry");
    try {
      const response = await retryHrms(batch.id);
      setNotice(response.message);
      setRetryOpen(false);
      await load();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "HRMS retry failed."));
      setRetryOpen(false);
    } finally {
      setAction("");
    }
  };
  const cancel = async ({ reason }) => {
    setAction("cancel");
    try {
      const response = await cancelPaymentBatch(batch.id, reason.trim());
      setNotice(response.message);
      setCancelOpen(false);
      reset();
      await load();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Cancellation failed."));
    } finally {
      setAction("");
    }
  };

  if (loading) return <Box className="payment-batch-loading"><CircularProgress /></Box>;
  if (!batch) return <Box className="content-page"><ErrorState message={error || "Payment batch not found."} onRetry={load} /></Box>;

  const totalEmployees = Number(batch.employeeCount || batch.items?.length || 0);
  const readyEmployees = batch.items?.length || totalEmployees;
  const excludedEmployees = Math.max(totalEmployees - readyEmployees, 0);
  const downloadable = batch.status !== "cancelled" && Boolean(batch.paymentFile) && readyEmployees > 0;
  const failedSync = batch.hrmsSyncStatus === "failed" || batch.status === "hrms_sync_failed";
  const generatedOn = batch.generatedAt || batch.createdAt;
  const createdBy = batch.generatedBy?.fullName || dash;
  const checksum = batch.paymentFile?.checksumSha256;

  return <Box className="page-enter content-page payment-batch-details-page">
    <Box className="payment-batch-detail-header">
      <Box className="payment-batch-detail-heading">
        <IconButton aria-label="Back to Payment Batches" onClick={() => navigate("/payments")}><ArrowBackRounded /></IconButton>
        <Box>
          <Box className="payment-batch-title-line"><Typography component="h1">Payment Batch {batch.batchReference}</Typography><StatusChip status={batch.status} label={paymentStatusLabel(batch.status)} /></Box>
          <Typography>{batch.payPeriod ? formatPeriod(batch.payPeriod.startDate, batch.payPeriod.endDate) : dash} <span>•</span> Generated on {formatDateTime(generatedOn)} by {createdBy}</Typography>
        </Box>
      </Box>
      <Stack className="payment-batch-header-actions" direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <Button variant="outlined" startIcon={action === "download" ? <CircularProgress size={17} /> : <DownloadRounded />} disabled={!downloadable || Boolean(action)} onClick={download}>Download Payment File (GIRO)</Button>
        <Button variant="contained" startIcon={<DescriptionRounded />} onClick={() => navigate(`/payslips?batchId=${batch.id}`)}>View Payslips</Button>
      </Stack>
    </Box>
    {error && <Alert severity="error" className="payment-detail-alert">{error}</Alert>}
    {batch.hrmsErrorMessage && <Alert severity="error" className="payment-detail-alert">HRMS: {batch.hrmsErrorMessage}</Alert>}
    {batch.cancellationReason && <Alert severity="warning" className="payment-detail-alert">Cancellation reason: {batch.cancellationReason}</Alert>}

    <Box className="payment-batch-detail-layout">
      <Box>
        <Card className="payment-detail-summary-card"><CardContent>
          <Typography component="h2">Payment Batch Summary</Typography>
          <Box className="payment-detail-summary-grid">
            <Box><Box className="payment-detail-summary-icon"><GroupsRounded /></Box><Box><Typography>Total Employees</Typography><Typography>{totalEmployees}</Typography><Typography>{percent(totalEmployees, totalEmployees)}</Typography></Box></Box>
            <Box><Box className="payment-detail-summary-icon is-success"><TaskAltRounded /></Box><Box><Typography>Ready for Payment</Typography><Typography>{readyEmployees}</Typography><Typography className="is-success">{percent(readyEmployees, totalEmployees)}</Typography></Box></Box>
            <Box><Box className="payment-detail-summary-icon is-warning"><WarningAmberRounded /></Box><Box><Typography>Excluded</Typography><Typography>{excludedEmployees}</Typography><Typography className="is-warning">{percent(excludedEmployees, totalEmployees)}</Typography></Box></Box>
            <Box><Box className="payment-detail-summary-icon"><PaymentsRounded /></Box><Box><Typography>Net Payment Amount</Typography><Typography>{formatCurrency(batch.totalAmount)}</Typography><Typography>Amount to be paid</Typography></Box></Box>
          </Box>
          <Alert severity="info" icon={<InfoOutlined />}>Only employees with complete and valid bank details are included in the payment file.</Alert>
        </CardContent></Card>

        <Card className="payment-detail-information-card"><CardContent><Typography component="h2">Payment File Information</Typography>
          <Box className="payment-detail-list payment-detail-list-wide">
            <DetailRow label="Payment File Name">{batch.paymentFile?.fileName || dash}</DetailRow>
            <DetailRow label="File Format">{batch.fileFormat ? `${batch.fileFormat.toUpperCase()} (CSV)` : dash}</DetailRow>
            <DetailRow label="Payment Type">{batch.paymentType || dash}</DetailRow>
            <DetailRow label="Currency">{batch.currency || dash}</DetailRow>
            <DetailRow label="File Size">{fileSize(batch.paymentFile?.sizeBytes)}</DetailRow>
            <DetailRow label="Created On">{formatDateTime(generatedOn)}</DetailRow>
            <DetailRow label="Created By">{createdBy}</DetailRow>
            <DetailRow label="Checksum (SHA256)">{checksum ? <Box className="payment-checksum"><span>{`${checksum.slice(0, 16)}…`}</span><Tooltip title="Copy full SHA-256 checksum"><IconButton size="small" aria-label="Copy full SHA-256 checksum" onClick={copyChecksum}><ContentCopyRounded fontSize="small" /></IconButton></Tooltip></Box> : dash}</DetailRow>
          </Box>
        </CardContent></Card>
      </Box>

      <Card className="payment-detail-hrms-card"><CardContent>
        <Typography component="h2">HRMS Sync Status</Typography>
        <Box className="payment-hrms-chip"><StatusChip status={batch.hrmsSyncStatus} label={hrmsStatusLabel(batch.hrmsSyncStatus)} /></Box>
        <Box className="payment-detail-list">
          <DetailRow label="Status">{hrmsStatusLabel(batch.hrmsSyncStatus)}</DetailRow>
          {batch.hrmsSyncedAt && <DetailRow label="Synced On">{formatDateTime(batch.hrmsSyncedAt)}</DetailRow>}
          {batch.hrmsReference && <DetailRow label="HRMS Reference ID">{batch.hrmsReference}</DetailRow>}
          {batch.hrmsErrorMessage && <DetailRow label="Error Message">{batch.hrmsErrorMessage}</DetailRow>}
        </Box>
        {(failedSync || ["generated", "hrms_sync_failed"].includes(batch.status)) && <Stack spacing={1.2} className="payment-hrms-actions">
          {failedSync && <Button variant="contained" color="warning" startIcon={<RefreshRounded />} onClick={() => setRetryOpen(true)}>Retry HRMS</Button>}
          {["generated", "hrms_sync_failed"].includes(batch.status) && <Button color="error" startIcon={<CancelRounded />} onClick={() => setCancelOpen(true)}>Cancel Payment Batch</Button>}
        </Stack>}
      </CardContent></Card>
    </Box>

    <Card className="payment-detail-information-card"><CardContent>
      <Typography component="h2">Employees in this Payment Batch ({batch.items?.length || 0})</Typography>
      {batch.items?.length
        ? <PaymentBatchItemsTable items={batch.items} />
        : <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>No payment items found for this batch.</Typography>}
    </CardContent></Card>

    <ConfirmDialog open={retryOpen} title="Retry HRMS synchronisation" message="Retry the retained payment batch without regenerating the payment file?" confirmLabel="Retry HRMS" onClose={() => setRetryOpen(false)} onConfirm={retry} loading={action === "retry"} />
    <ConfirmDialog open={cancelOpen} title="Cancel payment batch" message="This financial record will be soft-cancelled and cannot be downloaded afterward." confirmLabel="Cancel batch" danger onClose={() => { setCancelOpen(false); reset(); }} onConfirm={handleSubmit(cancel)} loading={action === "cancel"}><Controller name="reason" control={control} render={({ field }) => <TextField {...field} label="Cancellation reason" fullWidth multiline minRows={2} margin="normal" error={Boolean(errors.reason)} helperText={errors.reason?.message} />} /></ConfirmDialog>
    <Snackbar open={Boolean(notice)} autoHideDuration={4500} onClose={() => setNotice("")} message={notice} />
  </Box>;
}
