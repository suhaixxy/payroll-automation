import { ArrowBackRounded, InfoOutlined, SearchRounded, WarningAmberRounded } from "@mui/icons-material";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Snackbar,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getPaymentPreview } from "../api/paymentApi";
import { updateBankDetails } from "../api/staffApi";
import { BankDetailsDialog } from "../components/PaymentComponents";
import { EmptyState, ErrorState } from "../components/CommonComponents";
import { buildPaymentPreviewRows, getPreviewCounts, matchesEmployeeSearch } from "../utils/paymentPreviewData";
import { formatCurrency, getErrorMessage } from "../utils";

const PAGE_SIZE = 10;
const hasValidStaffId = (staffId) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(staffId || "");

export default function ReviewEmployeesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const payPeriodId = searchParams.get("payPeriodId") || "";
  const requestedTab = searchParams.get("tab");
  const activeTab = requestedTab === "invalid" ? "invalid" : "missing";
  const [rows, setRows] = useState(() => buildPaymentPreviewRows({}));
  const [loading, setLoading] = useState(Boolean(payPeriodId));
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [bankEmployee, setBankEmployee] = useState(null);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankError, setBankError] = useState("");
  const [notice, setNotice] = useState("");
  const { missing, invalid } = useMemo(() => getPreviewCounts(rows), [rows]);
  const activeRows = activeTab === "missing" ? missing : invalid;
  const filteredRows = useMemo(() => activeRows.filter((employee) => matchesEmployeeSearch(employee, search)), [activeRows, search]);
  const visibleRows = filteredRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const pageCount = Math.ceil(filteredRows.length / PAGE_SIZE);

  const loadRows = useCallback(async () => {
    if (!payPeriodId) {
      setRows([]);
      setLoadError("No pay period was selected. Return to Payment Preview and choose a pay period.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const preview = await getPaymentPreview(payPeriodId);
      setRows(buildPaymentPreviewRows({ preview }));
      setPage(0);
    } catch (requestError) {
      setRows([]);
      setLoadError(getErrorMessage(requestError, "Unable to load employees for this pay period."));
    } finally {
      setLoading(false);
    }
  }, [payPeriodId]);

  useEffect(() => { loadRows(); }, [loadRows]);

  useEffect(() => {
    if (requestedTab !== "missing" && requestedTab !== "invalid") {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("tab", "missing");
      setSearchParams(nextParams, { replace: true });
    }
  }, [requestedTab, searchParams, setSearchParams]);

  const switchTab = (_, value) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", value);
    setSearchParams(nextParams);
    setSearch("");
    setPage(0);
  };
  const backToPreview = () => navigate("/payments/preview", { state: { selectedId: payPeriodId } });
  const handleSave = async (values) => {
    setBankSaving(true);
    setBankError("");
    try {
      const response = await updateBankDetails(bankEmployee.staffId, values);
      const refreshedPreview = await getPaymentPreview(payPeriodId);
      setRows(buildPaymentPreviewRows({ preview: refreshedPreview }));
      setPage(0);
      setBankEmployee(null);
      setNotice(`${response.data.employeeName}'s bank details were updated.`);
    } catch (requestError) {
      setBankError(getErrorMessage(requestError, "Unable to update bank details."));
    } finally {
      setBankSaving(false);
    }
  };

  return (
    <Box className="page-enter content-page review-employees-page">
      <Box className="review-employees-heading">
        <IconButton aria-label="Back to Payment Preview" onClick={backToPreview}><ArrowBackRounded /></IconButton>
        <Typography component="h1">Review Employees</Typography>
      </Box>
      <Typography className="review-employees-subtitle">Resolve employee issues to include them in payment generation.</Typography>

      {loading ? <Box className="payment-preview-loading" role="status" aria-label="Loading employees"><CircularProgress /></Box> : loadError ? (
        <ErrorState message={loadError} onRetry={payPeriodId ? loadRows : undefined} />
      ) : <>
      <Box className="review-employees-toolbar">
        <Tabs value={activeTab} onChange={switchTab} aria-label="Employee issue category">
          <Tab value="missing" label={`Missing Bank Details (${missing.length})`} />
          <Tab value="invalid" label={`Invalid Bank Details (${invalid.length})`} />
        </Tabs>
        <TextField
          size="small"
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(0); }}
          placeholder="Search employee…"
          aria-label="Search employees in selected issue category"
          slotProps={{ input: { endAdornment: <InputAdornment position="end"><SearchRounded /></InputAdornment> } }}
        />
      </Box>

      <Alert severity="warning" icon={<WarningAmberRounded />} className="review-employees-warning">
        <Typography>Employees with missing or invalid bank details will be excluded from payment file generation.</Typography>
        <Typography>Please review and update their bank information to include them in the payment.</Typography>
      </Alert>

      <Card className="review-employees-table-card">
        <Box className="review-table-title">
          <Typography component="h2">{activeTab === "missing" ? "Missing Bank Details" : "Invalid Bank Details"} ({activeRows.length})</Typography>
        </Box>
        {visibleRows.length ? (
          <>
            <TableContainer>
              <Table aria-label={`${activeTab} bank details employees`}>
                <TableHead><TableRow>
                  <TableCell>No.</TableCell><TableCell>Employee</TableCell>
                  <TableCell align="right">Net Pay</TableCell><TableCell>Issue</TableCell><TableCell>Current Information</TableCell><TableCell align="right">Action</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {visibleRows.map((employee, index) => (
                    <TableRow key={employee.staffId || employee.employeeReference}>
                      <TableCell>{page * PAGE_SIZE + index + 1}</TableCell>
                      <TableCell><Box className="payment-employee-cell"><Avatar>{employee.initials}</Avatar><Box><Typography>{employee.employeeName}</Typography><Typography>{employee.employeeReference}</Typography></Box></Box></TableCell>
                      <TableCell align="right">{formatCurrency(employee.approvedNetPay)}</TableCell>
                      <TableCell><Chip size="small" color={activeTab === "missing" ? "error" : "warning"} label={activeTab === "missing" ? "Missing Bank Details" : "Invalid Bank Details"} /></TableCell>
                      <TableCell>{activeTab === "invalid" ? `Reason: ${employee.issueReason}` : employee.issueReason}</TableCell>
                      <TableCell align="right">
                        {hasValidStaffId(employee.staffId) ? (
                          <Button variant="outlined" size="small" onClick={() => setBankEmployee(employee)}>
                            {activeTab === "missing" ? "Add Bank Details" : "Fix Bank Details"}
                          </Button>
                        ) : (
                          <Typography variant="body2" color="text.secondary" aria-label="Action unavailable">—</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Box className="review-pagination">
              <Typography>Showing {page * PAGE_SIZE + 1} to {Math.min((page + 1) * PAGE_SIZE, filteredRows.length)} of {filteredRows.length} results</Typography>
              {pageCount > 1 && <Box>
                <Button variant="outlined" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Previous</Button>
                <Typography component="span">{page + 1}</Typography>
                <Button variant="outlined" disabled={page >= pageCount - 1} onClick={() => setPage((current) => current + 1)}>Next</Button>
              </Box>}
            </Box>
          </>
        ) : (
          <EmptyState
            title={`No employees with ${activeTab} bank details.`}
            message={missing.length === 0 && invalid.length === 0 ? "All employee bank details are valid." : "No employees in this category match your search."}
          />
        )}
      </Card>

      <Alert severity="info" icon={<InfoOutlined />} className="review-employees-info">
        <Typography fontWeight={700}>Why some employees are excluded?</Typography>
        <Typography><strong>Missing Bank Details:</strong> Employees without bank account information cannot be paid.</Typography>
        <Typography><strong>Invalid Bank Details:</strong> Bank information does not meet the required format or validation rules.</Typography>
        <Typography>Once resolved, employees will be included in payment file generation.</Typography>
      </Alert>
      </>}

      <BankDetailsDialog open={Boolean(bankEmployee)} employee={bankEmployee} onClose={() => setBankEmployee(null)} onSave={handleSave} loading={bankSaving} serverError={bankError} />
      <Snackbar open={Boolean(notice)} autoHideDuration={4500} onClose={() => setNotice("")} message={notice} />
    </Box>
  );
}
