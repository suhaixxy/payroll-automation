import { yupResolver } from "@hookform/resolvers/yup";
import { DownloadRounded, OpenInNewRounded, VisibilityRounded } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import * as yup from "yup";
import { formatCurrency, formatDate, formatDateTime, formatPeriod, sortByTimestampsNewestFirst } from "../utils";
import { ConfirmDialog, StatusChip } from "./CommonComponents";

const bankDetailsSchema = yup.object({
  bankCode: yup.string().trim().matches(/^[A-Za-z0-9-]{3,20}$/, "Use 3-20 letters, numbers, or hyphens").required("Bank code is required"),
  bankAccountNumber: yup.string().trim().matches(/^[A-Za-z0-9-]{5,50}$/, "Use 5-50 letters, numbers, or hyphens").required("Bank account number is required"),
});

function BankDetailsDialog({ employee, open, onClose, onSave, loading, serverError }) {
  const { control, handleSubmit, reset, formState: { errors } } = useForm({ resolver: yupResolver(bankDetailsSchema), defaultValues: { bankCode: "", bankAccountNumber: "" } });
  const status = employee?.bankValidationStatus || employee?.status;
  const actionLabel = status === "missing" ? "Add Bank Details" : status === "invalid" ? "Fix Bank Details" : "Edit Bank Details";
  useEffect(() => {
    if (open) {
      const displayableBankCode = /^[A-Za-z0-9-]{3,20}$/.test(employee?.bankCode || "") ? employee.bankCode : "";
      reset({ bankCode: displayableBankCode, bankAccountNumber: "" });
    }
  }, [employee, open, reset]);
  const bankDetailsMessage = status === "missing"
    ? "Enter the employee's bank code and account number."
    : "The full stored account number is not displayed. Enter a new account number; saving will replace the existing stored bank details.";
  return <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="sm"><DialogTitle>{actionLabel}</DialogTitle><DialogContent>
    <Alert severity="info" sx={{ mb: 2 }}>Updating {employee?.employeeName} ({employee?.employeeReference}). {bankDetailsMessage}</Alert>
    {serverError && <Alert severity="error" sx={{ mb: 1 }}>{serverError}</Alert>}
    <Controller name="bankCode" control={control} render={({ field }) => <TextField {...field} label="Bank code" fullWidth margin="normal" error={Boolean(errors.bankCode)} helperText={errors.bankCode?.message} autoComplete="off" />} />
    <Controller name="bankAccountNumber" control={control} render={({ field }) => <TextField {...field} label="Bank account number" placeholder="Enter new bank account number" fullWidth margin="normal" error={Boolean(errors.bankAccountNumber)} helperText={errors.bankAccountNumber?.message} autoComplete="off" />} />
  </DialogContent><DialogActions sx={{ p: 2.5 }}><Button color="inherit" onClick={onClose} disabled={loading}>Cancel</Button><Button variant="contained" onClick={handleSubmit(onSave)} disabled={loading} startIcon={loading ? <CircularProgress size={17} color="inherit" /> : null}>Save securely</Button></DialogActions></Dialog>;
}

function GeneratePaymentDialog({ open, preview, onClose, onConfirm, loading }) {
  if (!preview) return null;
  return <ConfirmDialog open={open} title="Generate payment batch" confirmLabel="Generate and sync" onClose={onClose} onConfirm={onConfirm} loading={loading}>
    <Alert severity="warning" sx={{ mb: 2 }}>This creates permanent payment records and starts HRMS synchronisation using approved values.</Alert>
    <Box className="dialog-summary-grid"><Typography color="text.secondary">Pay period</Typography><Typography fontWeight={700}>{formatPeriod(preview.payPeriod.startDate, preview.payPeriod.endDate)}</Typography><Typography color="text.secondary">Employees</Typography><Typography fontWeight={700}>{preview.employeeCount}</Typography><Typography color="text.secondary">Total payment</Typography><Typography fontWeight={700}>{formatCurrency(preview.totalAmount)}</Typography></Box>
  </ConfirmDialog>;
}

function PaymentBatchItemsTable({ items }) {
  return <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Bank</TableCell><TableCell align="right">Gross</TableCell><TableCell align="right">Incentive</TableCell><TableCell align="right">CPF</TableCell><TableCell align="right">SDL</TableCell><TableCell align="right">Net pay</TableCell><TableCell>Payment reference</TableCell></TableRow></TableHead><TableBody>{items.map((item) => <TableRow key={item.id} hover><TableCell><strong>{item.employeeName}</strong><br /><small>{item.employeeReference}</small></TableCell><TableCell>{item.bankCode}<br /><small>{item.bankAccountNumber}</small></TableCell><TableCell align="right">{formatCurrency(item.grossPay)}</TableCell><TableCell align="right">{formatCurrency(item.incentivePay)}</TableCell><TableCell align="right">{formatCurrency(item.cpfAmount)}</TableCell><TableCell align="right">{formatCurrency(item.sdlAmount)}</TableCell><TableCell align="right"><strong>{formatCurrency(item.netPay)}</strong></TableCell><TableCell>{item.paymentReference}</TableCell></TableRow>)}</TableBody></Table></TableContainer>;
}

function PaymentBatchTable({ rows, onDownload, downloadingId }) {
  const navigate = useNavigate();
  const sortedRows = sortByTimestampsNewestFirst(rows, (batch) => batch.generatedAt ?? batch.createdAt);
  return <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Batch reference</TableCell><TableCell>Pay period ID</TableCell><TableCell>Status</TableCell><TableCell>HRMS</TableCell><TableCell align="right">Employees</TableCell><TableCell align="right">Total</TableCell><TableCell>Generated</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>{sortedRows.map((batch) => <TableRow hover key={batch.id}><TableCell sx={{ fontWeight: 700 }}>{batch.batchReference}</TableCell><TableCell><span className="mono-id">{batch.payPeriodId}</span></TableCell><TableCell><StatusChip status={batch.status} /></TableCell><TableCell><StatusChip status={batch.hrmsSyncStatus} /></TableCell><TableCell align="right">{batch.employeeCount}</TableCell><TableCell align="right">{formatCurrency(batch.totalAmount)}</TableCell><TableCell>{formatDateTime(batch.generatedAt)}</TableCell><TableCell align="right"><Tooltip title="View details"><IconButton aria-label={`View ${batch.batchReference}`} onClick={() => navigate(`/payments/${batch.id}`)}><OpenInNewRounded /></IconButton></Tooltip>{batch.status !== "cancelled" && <Tooltip title="Download CSV"><span><IconButton aria-label={`Download ${batch.batchReference} CSV`} disabled={downloadingId === batch.id} onClick={() => onDownload(batch)}><DownloadRounded /></IconButton></span></Tooltip>}</TableCell></TableRow>)}</TableBody></Table></TableContainer>;
}

function PayslipTable({ rows, onDownload, downloadingId }) {
  const navigate = useNavigate();
  const sortedRows = sortByTimestampsNewestFirst(
    rows,
    (payslip) => payslip.payPeriodStart,
    (payslip) => payslip.generatedAt,
  );
  return <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Payslip reference</TableCell><TableCell>Pay period</TableCell><TableCell align="right">Gross</TableCell><TableCell align="right">Incentive</TableCell><TableCell align="right">CPF</TableCell><TableCell align="right">SDL</TableCell><TableCell align="right">Other deduction</TableCell><TableCell align="right">Net pay</TableCell><TableCell>Generated</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>{sortedRows.map((payslip) => <TableRow key={payslip.id} hover><TableCell><strong>{payslip.employeeName}</strong><br /><small>{payslip.employeeReference}</small></TableCell><TableCell>{payslip.payslipReference}</TableCell><TableCell>{formatPeriod(payslip.payPeriodStart, payslip.payPeriodEnd)}</TableCell><TableCell align="right">{formatCurrency(payslip.grossPay)}</TableCell><TableCell align="right">{formatCurrency(payslip.incentivePay)}</TableCell><TableCell align="right">{formatCurrency(payslip.cpfAmount)}</TableCell><TableCell align="right">{formatCurrency(payslip.sdlAmount)}</TableCell><TableCell align="right">{formatCurrency(payslip.otherDeduction)}</TableCell><TableCell align="right"><strong>{formatCurrency(payslip.netPay)}</strong></TableCell><TableCell>{formatDate(payslip.generatedAt)}</TableCell><TableCell align="right"><Tooltip title="View payslip"><IconButton aria-label={`View ${payslip.payslipReference}`} onClick={() => navigate(`/payslips/${payslip.id}`)}><VisibilityRounded /></IconButton></Tooltip><Tooltip title="Download PDF"><span><IconButton aria-label={`Download ${payslip.payslipReference} PDF`} disabled={downloadingId === payslip.id} onClick={() => onDownload(payslip)}>{downloadingId === payslip.id ? <CircularProgress size={20} /> : <DownloadRounded />}</IconButton></span></Tooltip></TableCell></TableRow>)}</TableBody></Table></TableContainer>;
}

export { BankDetailsDialog, GeneratePaymentDialog, PaymentBatchItemsTable, PaymentBatchTable, PayslipTable };
