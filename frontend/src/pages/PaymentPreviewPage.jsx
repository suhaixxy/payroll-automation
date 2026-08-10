import {
  AccountBalanceWalletRounded,
  CheckCircleRounded,
  GroupsRounded,
  RefreshRounded,
  SearchRounded,
  WarningAmberRounded,
} from "@mui/icons-material";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
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
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getEligiblePeriods, getPaymentPreview } from "../api/paymentApi";
import { updateBankDetails } from "../api/staffApi";
import { BankDetailsDialog } from "../components/PaymentComponents";
import { EmptyState, ErrorState, PageHeader } from "../components/CommonComponents";
import { buildPaymentPreviewRows, getPreviewCounts, matchesEmployeeSearch } from "../utils/paymentPreviewData";
import { formatCurrency, formatPeriod, getErrorCode, getErrorDetails, getErrorMessage, sortPayPeriodsNewestFirst } from "../utils";

const statusLabels = { ready: "Ready", missing: "Missing", invalid: "Invalid" };
const bankActionLabels = { ready: "Edit Bank Details", missing: "Add Bank Details", invalid: "Fix Bank Details" };

function PreviewMetric({ icon, label, value, description, tone = "primary" }) {
  return (
    <Card className={`payment-preview-metric is-${tone}`}>
      <CardContent>
        <Box className="payment-preview-metric-icon">{icon}</Box>
        <Box>
          <Typography className="payment-preview-metric-label">{label}</Typography>
          <Typography className="payment-preview-metric-value">{value}</Typography>
          <Typography className="payment-preview-metric-description">{description}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function PaymentPreviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [periods, setPeriods] = useState([]);
  const [selectedId, setSelectedId] = useState(location.state?.selectedId || "");
  const [preview, setPreview] = useState(null);
  const [missingDetails, setMissingDetails] = useState([]);
  const [emptyPayroll, setEmptyPayroll] = useState(false);
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [bankEmployee, setBankEmployee] = useState(null);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankError, setBankError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPeriods = useCallback(async () => {
    setLoadingPeriods(true);
    setError("");
    try {
      const response = await getEligiblePeriods();
      const sortedPeriods = sortPayPeriodsNewestFirst(response.rows || []);
      setPeriods(sortedPeriods);
      const availableIds = sortedPeriods.filter((item) => !item.hasActivePaymentBatch).map((item) => String(item.id));
      let resolvedId = "";
      setSelectedId((current) => {
        resolvedId = current && availableIds.includes(String(current)) ? current : (availableIds[0] || "");
        return resolvedId;
      });
      return resolvedId;
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to load approved pay periods."));
      return "";
    } finally {
      setLoadingPeriods(false);
    }
  }, []);

  const checkReadiness = useCallback(async () => {
    if (!selectedId || checking) return;
    setChecking(true);
    setError("");
    setMissingDetails([]);
    setPreview(null);
    setEmptyPayroll(false);
    try {
      setPreview(await getPaymentPreview(selectedId));
    } catch (requestError) {
      const errorCode = getErrorCode(requestError);
      if (errorCode === "MISSING_BANK_DETAILS") {
        setMissingDetails(getErrorDetails(requestError));
      } else if (errorCode === "PAYROLL_LINES_MISSING") {
        setEmptyPayroll(true);
      } else {
        setError(getErrorMessage(requestError, "Payment preview could not be loaded."));
      }
    } finally {
      setChecking(false);
    }
  }, [selectedId, checking]);

  useEffect(() => { loadPeriods(); }, [loadPeriods]);
  useEffect(() => {
    if (selectedId) {
      setPage(0);
      checkReadiness();
    } else {
      setPreview(null);
      setMissingDetails([]);
      setEmptyPayroll(false);
    }
    // checkReadiness changes with its loading guard; the selected period is the intended trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const availablePeriods = useMemo(
    () => sortPayPeriodsNewestFirst(periods.filter((period) => !period.hasActivePaymentBatch)),
    [periods],
  );
  const hasPayrollLines = Boolean(preview?.employees?.length || missingDetails.length);
  const rows = useMemo(
    () => hasPayrollLines ? buildPaymentPreviewRows({ preview, missingDetails }) : [],
    [hasPayrollLines, preview, missingDetails],
  );
  const { missing, invalid, ready, excludedCount } = useMemo(() => getPreviewCounts(rows), [rows]);
  const unresolved = useMemo(() => [...missing, ...invalid], [missing, invalid]);
  const filteredRows = useMemo(() => rows.filter((employee) =>
    (statusFilter === "all" || employee.status === statusFilter) && matchesEmployeeSearch(employee, search)
  ), [rows, search, statusFilter]);
  const visibleRows = filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const totals = useMemo(() => ({
    gross: rows.reduce((sum, employee) => sum + Number(employee.grossPay || 0), 0),
    cpf: rows.reduce((sum, employee) => sum + Number(employee.cpfAmount || 0), 0),
    sdl: rows.reduce((sum, employee) => sum + Number(employee.sdlAmount || 0), 0),
    net: ready.reduce((sum, employee) => sum + Number(employee.approvedNetPay || 0), 0),
  }), [rows, ready]);

  const openReview = () => navigate(`/payments/review-employees?payPeriodId=${encodeURIComponent(selectedId)}&tab=missing`, { state: { selectedId, rows } });
  const handleRefresh = async () => {
    if (loadingPeriods || checking) return;
    setSearch("");
    setStatusFilter("all");
    setPage(0);
    const resolvedId = await loadPeriods();
    if (resolvedId && resolvedId === selectedId) await checkReadiness();
  };
  const handleBankSave = async (values) => {
    setBankSaving(true);
    setBankError("");
    try {
      const response = await updateBankDetails(bankEmployee.staffId, values);
      setNotice(`${response.data.employeeName}'s bank details were updated.`);
      setBankEmployee(null);
      await checkReadiness();
    } catch (requestError) {
      setBankError(getErrorMessage(requestError, "Unable to update bank details."));
    } finally {
      setBankSaving(false);
    }
  };
  const changeFilter = (setter) => (event) => { setter(event.target.value); setPage(0); };
  const handlePayPeriodChange = (event) => {
    setPreview(null);
    setMissingDetails([]);
    setEmptyPayroll(false);
    setError("");
    setSearch("");
    setStatusFilter("all");
    setPage(0);
    setSelectedId(event.target.value);
  };

  return (
    <Box className="page-enter content-page payment-preview-page">
      <PageHeader
        title="Payment Preview"
        subtitle="Review payroll details before generating payment batches."
        actions={<Button variant="outlined" startIcon={checking ? <CircularProgress size={17} /> : <RefreshRounded />} onClick={handleRefresh} disabled={loadingPeriods || checking}>Refresh</Button>}
      />
      {error && <ErrorState message={error} onRetry={handleRefresh} />}

      <Card className="payment-preview-period-card">
        <CardContent>
          <FormControl fullWidth disabled={loadingPeriods || availablePeriods.length === 0}>
            <InputLabel id="preview-period-label">Approved pay period</InputLabel>
            <Select
              labelId="preview-period-label"
              value={selectedId}
              label="Approved pay period"
              onChange={handlePayPeriodChange}
            >
              {availablePeriods.map((period) => (
                <MenuItem key={period.id} value={period.id}>
                  {formatPeriod(period.startDate, period.endDate)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {!loadingPeriods && periods.length === 0 && <EmptyState title="No approved periods available" message="A pay period must be approved and locked before payment processing." />}
          {!loadingPeriods && periods.length > 0 && availablePeriods.length === 0 && <EmptyState title="No pay periods available for payment generation" message="No approved pay periods are available for payment generation." />}
        </CardContent>
      </Card>

      {checking && <Box className="payment-preview-loading" role="status" aria-label="Loading payment preview"><CircularProgress /></Box>}

      {!checking && emptyPayroll && (
        <Card className="payment-preview-empty-card">
          <CardContent>
            <EmptyState title="No payroll lines exist for this pay period." message="Select another approved pay period or retry after payroll lines have been prepared." />
            <Box className="payment-preview-empty-action"><Button variant="outlined" startIcon={<RefreshRounded />} onClick={handleRefresh}>Retry</Button></Box>
          </CardContent>
        </Card>
      )}

      {!checking && !error && hasPayrollLines && <>
      {excludedCount > 0 && (
        <Alert severity="warning" icon={<WarningAmberRounded />} className="payment-validation-alert"
          action={<Button color="inherit" variant="outlined" onClick={openReview}>Review Employees</Button>}>
          <Typography fontWeight={700}>Payroll Validation</Typography>
          <Typography>{excludedCount} employees have missing or invalid bank account information.</Typography>
          <Typography variant="body2">These employees will be excluded from payment generation until resolved.</Typography>
        </Alert>
      )}

      <Box className="payment-preview-metrics">
        <PreviewMetric icon={<GroupsRounded />} label="Employees" value={rows.length} description="Total employees in batch" />
        <PreviewMetric icon={<CheckCircleRounded />} label="Ready for Payment" value={ready.length} description="Employees with complete details" tone="success" />
        <PreviewMetric icon={<WarningAmberRounded />} label="Payment Issues" value={excludedCount} description="Employees excluded" tone="error" />
        <PreviewMetric icon={<AccountBalanceWalletRounded />} label="Total Net Payment" value={formatCurrency(totals.net)} description="Amount ready for payment" />
      </Box>

      <Box className="payment-preview-workspace">
        <Card className="payment-preview-table-card">
          <Box className="payment-preview-card-heading">
            <Typography component="h2">Employee Payroll Preview</Typography>
            <Box className="payment-preview-filters">
              <TextField
                size="small"
                value={search}
                onChange={changeFilter(setSearch)}
                placeholder="Search employee…"
                aria-label="Search employees"
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> } }}
              />
              <FormControl size="small">
                <InputLabel id="preview-status-label">Status</InputLabel>
                <Select labelId="preview-status-label" label="Status" value={statusFilter} onChange={changeFilter(setStatusFilter)}>
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="ready">Ready</MenuItem>
                  <MenuItem value="missing">Missing Bank Details</MenuItem>
                  <MenuItem value="invalid">Invalid Bank Details</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
          <TableContainer>
            <Table aria-label="Employee payroll preview">
              <TableHead><TableRow>
                <TableCell>No.</TableCell><TableCell>Employee</TableCell>
                <TableCell align="right">Gross Pay</TableCell><TableCell align="right">CPF</TableCell><TableCell align="right">SDL</TableCell>
                <TableCell align="right">Net Pay</TableCell><TableCell>Bank Details</TableCell><TableCell>Status</TableCell><TableCell>Actions</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {visibleRows.map((employee, index) => (
                  <TableRow key={employee.staffId || employee.employeeReference}>
                    <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                    <TableCell><Box className="payment-employee-cell"><Avatar>{employee.initials}</Avatar><Box><Typography>{employee.employeeName}</Typography><Typography>{employee.employeeReference}</Typography></Box></Box></TableCell>
                    <TableCell align="right">{formatCurrency(employee.grossPay)}</TableCell>
                    <TableCell align="right">{formatCurrency(employee.cpfAmount)}</TableCell>
                    <TableCell align="right">{formatCurrency(employee.sdlAmount)}</TableCell>
                    <TableCell align="right">{formatCurrency(employee.approvedNetPay)}</TableCell>
                    <TableCell>
                      <Box className={`payment-bank-cell is-${employee.status}`}>
                        <Typography>{employee.status === "ready" ? employee.bankCode : statusLabels[employee.status]}</Typography>
                        <Typography>{employee.status === "ready" ? employee.bankAccountNumber : employee.status === "missing" ? "Add bank details" : "Update details"}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell><Chip size="small" label={statusLabels[employee.status]} color={employee.status === "ready" ? "success" : employee.status === "invalid" ? "warning" : "error"} /></TableCell>
                    <TableCell><Button size="small" onClick={() => setBankEmployee(employee)}>{bankActionLabels[employee.status]}</Button></TableCell>
                  </TableRow>
                ))}
                {visibleRows.length === 0 && <TableRow><TableCell colSpan={9}><EmptyState title="No matching employees" message="Adjust the employee search or status filter." /></TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={filteredRows.length} page={page} onPageChange={(_, nextPage) => setPage(nextPage)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[5, 10, 25]} />
        </Card>

        <Box className="payment-preview-side">
          <Card className="payment-preview-side-card">
            <CardContent>
              <Typography component="h2">Payment Summary</Typography>
              <Box className="payment-summary-list">
                <Box><span>Gross Payroll</span><strong>{formatCurrency(totals.gross)}</strong></Box>
                <Box><span>CPF</span><strong>-{formatCurrency(totals.cpf)}</strong></Box>
                <Box><span>SDL</span><strong>-{formatCurrency(totals.sdl)}</strong></Box>
                <Box className="payment-summary-net"><span>Net Payment Amount</span><strong>{formatCurrency(totals.net)}</strong></Box>
                <Box><span>Total Employees</span><strong>{rows.length}</strong></Box>
                <Box><span>Ready for Payment</span><strong className="is-success">{ready.length}</strong></Box>
                <Box><span>Excluded</span><strong className="is-error">{excludedCount}</strong></Box>
              </Box>
            </CardContent>
          </Card>
          <Card className="payment-preview-side-card">
            <CardContent>
              <Box className="payment-preview-side-title"><Typography component="h2">Employees Requiring Attention</Typography><Chip size="small" color="error" label={excludedCount} /></Box>
              <Box className="payment-attention-list">
                {unresolved.slice(0, 3).map((employee) => (
                  <Box className="payment-attention-item" key={employee.staffId || employee.employeeReference}>
                    <Avatar>{employee.initials}</Avatar>
                    <Box><Typography>{employee.employeeName} <span>({employee.employeeReference})</span></Typography><Typography>{employee.issueReason}</Typography></Box>
                    <Button size="small" onClick={() => setBankEmployee(employee)}>Update Employee</Button>
                  </Box>
                ))}
                {unresolved.length === 0 && <Typography color="success.main">All employee bank details are valid.</Typography>}
              </Box>
              {excludedCount > 0 && <Button className="payment-view-all" onClick={openReview}>View all ({excludedCount}) →</Button>}
            </CardContent>
          </Card>
        </Box>
      </Box>
      </>}

      <BankDetailsDialog open={Boolean(bankEmployee)} employee={bankEmployee} onClose={() => setBankEmployee(null)} onSave={handleBankSave} loading={bankSaving} serverError={bankError} />
      <Snackbar open={Boolean(notice)} autoHideDuration={4500} onClose={() => setNotice("")} message={notice} />
    </Box>
  );
}
