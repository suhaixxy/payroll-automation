import {
  CloseRounded,
  DownloadRounded,
  RefreshRounded,
  SearchRounded,
  VisibilityRounded,
} from "@mui/icons-material";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
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
import { useSearchParams } from "react-router-dom";
import { downloadPayslipPdf, getMyPayslips, getPayslip, getPayslips } from "../api/payslipApi";
import { EmptyState, ErrorState, PageHeader } from "../components/CommonComponents";
import { useAuth } from "../context/AuthContext";
import { formatCurrency, formatPeriod, getErrorMessage, saveBlobResponse, sortByTimestampsNewestFirst, sortPayPeriodsNewestFirst } from "../utils";

const PAGE_SIZE_OPTIONS = [5, 10, 25];
const dash = "—";
const initials = (name = "") => name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || dash;
const displayStatus = (status) => ({
  completed: "Paid",
  generated: "Pending",
  hrms_sync_pending: "Pending",
  hrms_sync_failed: "Failed",
  cancelled: "Cancelled",
}[status] || status?.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Available");
const statusColor = (status) => status === "completed" ? "success" : status === "hrms_sync_failed" ? "error" : ["generated", "hrms_sync_pending"].includes(status) ? "warning" : "default";

function PreviewField({ label, value }) {
  return <Box><Typography>{label}</Typography><Typography>{value || dash}</Typography></Box>;
}

function AmountList({ title, rows, totalLabel, total }) {
  return <Box className="payslip-preview-section">
    <Typography component="h3">{title}</Typography>
    <Box className="payslip-amount-list">
      {rows.map((item) => <Box key={item.code}><span>{item.description}</span><strong>{formatCurrency(item.amount)}</strong></Box>)}
      {!rows.length && <Typography color="text.secondary">No entries</Typography>}
      <Box className="is-total"><span>{totalLabel}</span><strong>{formatCurrency(total)}</strong></Box>
    </Box>
  </Box>;
}

export default function PayslipsPage() {
  const [searchParams] = useSearchParams();
  const batchId = searchParams.get("batchId");
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [notice, setNotice] = useState("");
  const [downloadingId, setDownloadingId] = useState("");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = user.role === "employee" ? await getMyPayslips() : await getPayslips();
      setRows((response.rows || []).filter((payslip) => !batchId || payslip.paymentBatchId === batchId));
    } catch (requestError) {
      setRows([]);
      setError(getErrorMessage(requestError, "Unable to load payslips."));
    } finally {
      setLoading(false);
    }
  }, [user.role, batchId]);
  useEffect(() => { load(); }, [load]);

  const payPeriods = useMemo(() => sortPayPeriodsNewestFirst(
    [...new Map(rows.filter((item) => item.payPeriodId).map((item) => [String(item.payPeriodId), item])).values()],
    (item) => item.payPeriodStart,
  ), [rows]);
  const statuses = useMemo(() => [...new Set(rows.map((item) => item.status).filter(Boolean))], [rows]);
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    let result = [...rows];
    if (period) result = result.filter((item) => String(item.payPeriodId) === String(period));
    if (query) {
      result = result.filter((item) =>
        [item.employeeName, item.employeeReference]
          .some((value) => String(value || "").toLowerCase().includes(query))
      );
    }
    if (status) result = result.filter((item) => item.status === status);
    return sortByTimestampsNewestFirst(
      result,
      (item) => item.payPeriodStart,
      (item) => item.generatedAt,
    );
  }, [rows, search, period, status]);
  const visibleRows = filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const resetFilters = () => {
    setSearch("");
    setPeriod("");
    setStatus("");
    setPage(0);
  };
  const changeFilter = (setter) => (event) => { setter(event.target.value); setPage(0); };
  const view = async (payslip) => {
    setPreviewLoading(true);
    setPreviewError("");
    setSelected(null);
    try {
      setSelected(await getPayslip(payslip.id));
    } catch (requestError) {
      setPreviewError(getErrorMessage(requestError, "Unable to load payslip details."));
    } finally {
      setPreviewLoading(false);
    }
  };
  const download = async (payslip) => {
    if (downloadingId) return;
    setDownloadingId(payslip.id);
    try {
      const response = await downloadPayslipPdf(payslip.id);
      setNotice(`${saveBlobResponse(response, `${payslip.payslipReference}.pdf`)} downloaded.`);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Payslip PDF download failed."));
    } finally {
      setDownloadingId("");
    }
  };

  return <Box className="page-enter content-page payslips-page">
    <PageHeader title={user.role === "employee" ? "My Payslips" : "Payslips"} subtitle="View and download employee payslips." />
    <Box className={`payslips-layout ${selected || previewLoading || previewError ? "has-preview" : ""}`}>
      <Box className="payslips-main">
        <Card className="payslip-filter-card"><CardContent>
          <Box className="payslip-filters">
            <TextField value={search} onChange={changeFilter(setSearch)} size="small" placeholder="Search employee name or ID..." aria-label="Search payslips" slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> } }} />
            <FormControl size="small"><InputLabel>Pay Period</InputLabel><Select value={period} label="Pay Period" onChange={changeFilter(setPeriod)}><MenuItem value="">All Pay Periods</MenuItem>{payPeriods.map((item) => <MenuItem key={item.payPeriodId} value={String(item.payPeriodId)}>{formatPeriod(item.payPeriodStart, item.payPeriodEnd)}</MenuItem>)}</Select></FormControl>
            <FormControl size="small"><InputLabel>Status</InputLabel><Select value={status} label="Status" onChange={changeFilter(setStatus)}><MenuItem value="">All Statuses</MenuItem>{statuses.map((value) => <MenuItem key={value} value={value}>{displayStatus(value)}</MenuItem>)}</Select></FormControl>
            <Button variant="outlined" startIcon={<RefreshRounded />} onClick={resetFilters}>Reset</Button>
          </Box>
        </CardContent></Card>

        <Card className="payslip-list-card">
          <Box className="payslip-list-heading"><Typography component="h2">Payslip List ({filteredRows.length})</Typography></Box>
          {loading ? <Box className="payslip-loading"><CircularProgress /></Box> : error ? <CardContent><ErrorState message={error} onRetry={load} /></CardContent> : !filteredRows.length ? <EmptyState title="No payslips available" message={rows.length ? "No payslips match the selected filters." : "Payslips appear after a payment batch completes successfully."} /> : <>
            <TableContainer><Table aria-label="Payslips">
              <TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Pay Period</TableCell><TableCell align="right">Net Pay</TableCell><TableCell>Status</TableCell><TableCell align="center">Actions</TableCell></TableRow></TableHead>
              <TableBody>{visibleRows.map((payslip) => <TableRow key={payslip.id}>
                <TableCell><Box className="payslip-employee"><Avatar>{initials(payslip.employeeName)}</Avatar><Box><Typography>{payslip.employeeName}</Typography><Typography>{payslip.employeeReference}</Typography></Box></Box></TableCell>
                <TableCell>{formatPeriod(payslip.payPeriodStart, payslip.payPeriodEnd)}</TableCell>
                <TableCell align="right">{formatCurrency(payslip.netPay)}</TableCell>
                <TableCell><Chip size="small" label={displayStatus(payslip.status)} color={statusColor(payslip.status)} /></TableCell>
                <TableCell align="center"><Box className="payslip-actions">
                  <Tooltip title="View payslip"><IconButton aria-label={`View ${payslip.payslipReference}`} onClick={() => view(payslip)}><VisibilityRounded /></IconButton></Tooltip>
                  <Tooltip title="Download PDF"><span><IconButton aria-label={`Download ${payslip.payslipReference} PDF`} disabled={Boolean(downloadingId)} onClick={() => download(payslip)}>{downloadingId === payslip.id ? <CircularProgress size={19} /> : <DownloadRounded />}</IconButton></span></Tooltip>
                </Box></TableCell>
              </TableRow>)}</TableBody>
            </Table></TableContainer>
            <TablePagination component="div" count={filteredRows.length} page={page} onPageChange={(_, nextPage) => setPage(nextPage)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={PAGE_SIZE_OPTIONS} />
          </>}
        </Card>
      </Box>

      {(selected || previewLoading || previewError) && <Card className="payslip-preview-card">
        <Box className="payslip-preview-heading"><Typography component="h2">Payslip Preview</Typography><IconButton aria-label="Close payslip preview" onClick={() => { setSelected(null); setPreviewError(""); }}><CloseRounded /></IconButton></Box>
        {previewLoading ? <Box className="payslip-loading"><CircularProgress /></Box> : previewError ? <CardContent><ErrorState message={previewError} /></CardContent> : selected && <CardContent>
          <Box className="payslip-preview-company"><Typography component="h2">{selected.companyName}</Typography><Box><Typography>{formatPeriod(selected.payPeriodStart, selected.payPeriodEnd)}</Typography></Box></Box>
          <Box className="payslip-preview-details">
            <Box><PreviewField label="Employee Name" value={selected.employeeName} /><PreviewField label="Employee ID" value={selected.employeeReference} /></Box>
            {(selected.bank || selected.bankAccountNumber || selected.paymentMethod) && <Box><PreviewField label="Bank" value={selected.bank} /><PreviewField label="Account Number" value={selected.bankAccountNumber} /><PreviewField label="Payment Method" value={selected.paymentMethod} /></Box>}
          </Box>
          <AmountList title="Earnings" rows={selected.earnings || []} totalLabel="Total Earnings" total={selected.totalEarnings} />
          <AmountList title="Deductions" rows={selected.deductions || []} totalLabel="Total Deductions" total={selected.totalDeductions} />
          <Box className="payslip-preview-net"><span>Net Pay</span><strong>{formatCurrency(selected.netPay)}</strong></Box>
          <Typography className="payslip-preview-note">This is a computer generated payslip. No signature is required.</Typography>
          <Button fullWidth variant="contained" startIcon={downloadingId === selected.id ? <CircularProgress size={18} color="inherit" /> : <DownloadRounded />} disabled={Boolean(downloadingId)} onClick={() => download(selected)}>Download PDF</Button>
        </CardContent>}
      </Card>}
    </Box>
    <Snackbar open={Boolean(notice)} autoHideDuration={4000} onClose={() => setNotice("")} message={notice} />
  </Box>;
}
