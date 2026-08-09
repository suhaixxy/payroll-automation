import { useCallback, useEffect, useState } from "react";
import { AssignmentLateRounded, CheckCircleRounded, HourglassTopRounded, ReportProblemRounded } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { createBackpayReport, fetchBackpayReports, resolveBackpayReport } from "../api/backpay";
import { fetchPayPeriods } from "../api/roster";
import { getStaff } from "../api/staff";
import { PageHeader } from "../components/CommonComponents";
import { formatStatus } from "../utils";
import "../styles/rosterSync.css";

const emptyForm = { staff_id: "", pay_period_id: "", missing_regular_hours: "", missing_ot_hours: "", description: "" };

function BackpayReportsPage() {
  const [reports, setReports] = useState([]);
  const [staff, setStaff] = useState([]);
  const [payPeriods, setPayPeriods] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedStaff = staff.find((member) => member.id === form.staff_id);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [nextStaff, nextPayPeriods, nextReports] = await Promise.all([
        getStaff("active"),
        fetchPayPeriods(),
        fetchBackpayReports(statusFilter ? { status: statusFilter } : {}),
      ]);
      setStaff(nextStaff);
      setPayPeriods(nextPayPeriods);
      setReports(nextReports);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateForm = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const openForm = () => {
    setForm(emptyForm);
    setShowForm(true);
    setErrorMessage("");
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const data = {
        staff_id: form.staff_id,
        pay_period_id: form.pay_period_id,
      };
      if (selectedStaff?.employmentType === "part_time") {
        data.missing_regular_hours = form.missing_regular_hours;
        if (form.missing_ot_hours) data.missing_ot_hours = form.missing_ot_hours;
      } else {
        data.description = form.description;
      }
      await createBackpayReport(data);
      setForm(emptyForm);
      setShowForm(false);
      await loadData();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const resolveReport = async (id) => {
    setLoading(true);
    try {
      await resolveBackpayReport(id);
      await loadData();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="page-enter content-page backpay-page">
      <PageHeader
        title="Backpay Reports"
        subtitle="Record and track missed pay for past pay periods."
        actions={<Button variant="contained" startIcon={<ReportProblemRounded />} onClick={openForm} disabled={loading}>Report Missing Pay</Button>}
      />

      <Box className="backpay-summary-grid" aria-label="Backpay report summary">
        <Card className="backpay-summary-card"><CardContent><Box className="backpay-summary-icon"><AssignmentLateRounded /></Box><Box><Typography className="backpay-summary-label">Reports</Typography><Typography className="backpay-summary-value">{reports.length}</Typography><Typography className="backpay-summary-detail">in the current view</Typography></Box></CardContent></Card>
        <Card className="backpay-summary-card"><CardContent><Box className="backpay-summary-icon is-warning"><HourglassTopRounded /></Box><Box><Typography className="backpay-summary-label">Pending</Typography><Typography className="backpay-summary-value">{reports.filter((report) => report.status === "pending").length}</Typography><Typography className="backpay-summary-detail">awaiting resolution</Typography></Box></CardContent></Card>
        <Card className="backpay-summary-card"><CardContent><Box className="backpay-summary-icon is-success"><CheckCircleRounded /></Box><Box><Typography className="backpay-summary-label">Resolved</Typography><Typography className="backpay-summary-value">{reports.filter((report) => report.status === "resolved").length}</Typography><Typography className="backpay-summary-detail">completed reports</Typography></Box></CardContent></Card>
      </Box>

      <Card className="backpay-filter-card">
        <CardContent className="backpay-filter-content">
          <Box><Typography className="backpay-filter-title">Report status</Typography><Typography className="backpay-filter-description">Review outstanding backpay items or completed resolutions.</Typography></Box>
          <FormControl size="small" className="backpay-status-filter" sx={{ width: { xs: "100%", sm: 220 }, flexShrink: 0 }}>
            <InputLabel id="backpay-status-label">Status</InputLabel>
            <Select labelId="backpay-status-label" id="backpay-status" label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} disabled={loading}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {errorMessage && <Alert severity="error" className="backpay-alert">{errorMessage}</Alert>}

      {showForm && (
        <Card className="backpay-form-card">
          <CardContent>
            <Typography component="h2">Report Missing Pay</Typography>
            <Box component="form" className="backpay-form-grid" onSubmit={submitForm}>
              <FormControl size="small">
                <InputLabel id="backpay-staff-label">Staff member</InputLabel>
                <Select
                  labelId="backpay-staff-label"
                  label="Staff member"
                  value={form.staff_id}
                  onChange={updateForm}
                  disabled={loading}
                  id="backpay-staff"
                  name="staff_id"
                  required
                >
                  <MenuItem value="">Select active staff</MenuItem>
                  {staff.map((member) => <MenuItem key={member.id} value={member.id}>{member.fullName}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small">
                <InputLabel id="backpay-pay-period-label">Pay period</InputLabel>
                <Select
                  labelId="backpay-pay-period-label"
                  label="Pay period"
                  value={form.pay_period_id}
                  onChange={updateForm}
                  disabled={loading}
                  id="backpay-pay-period"
                  name="pay_period_id"
                  required
                >
                  <MenuItem value="">Select pay period</MenuItem>
                  {payPeriods.map((period) => <MenuItem key={period.id} value={period.id}>{period.startDate} to {period.endDate}</MenuItem>)}
                </Select>
              </FormControl>
              {selectedStaff?.employmentType === "part_time" && (
                <>
                  <TextField size="small" label="Missing regular hours" id="backpay-regular-hours" name="missing_regular_hours" type="number" value={form.missing_regular_hours} onChange={updateForm} disabled={loading} required />
                  <TextField size="small" label="Missing OT hours" id="backpay-ot-hours" name="missing_ot_hours" type="number" value={form.missing_ot_hours} onChange={updateForm} disabled={loading} />
                </>
              )}
              {selectedStaff?.employmentType === "full_time" && (
                <TextField
                  size="small"
                  label="Missing performance input"
                  id="backpay-description"
                  name="description"
                  value={form.description}
                  onChange={updateForm}
                  disabled={loading}
                  required
                  multiline
                  minRows={3}
                  className="backpay-description-field"
                />
              )}
              <Box className="backpay-form-actions">
                <Button type="submit" variant="contained" disabled={loading || !selectedStaff}>Create Report</Button>
                <Button type="button" variant="outlined" color="inherit" onClick={() => setShowForm(false)} disabled={loading}>Cancel</Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      <Card className="backpay-table-card">
        <Box className="backpay-table-heading"><Box><Typography component="h2">Backpay Register</Typography><Typography className="backpay-table-description">Track missing pay reports from submission through resolution.</Typography></Box><Chip size="small" label={`${reports.length} report${reports.length === 1 ? "" : "s"}`} variant="outlined" /></Box>
        {loading && <Box className="backpay-loading" role="status" aria-label="Loading backpay reports"><CircularProgress /></Box>}
        {!loading && reports.length === 0 && <Alert severity="info" className="backpay-empty">No backpay reports found.</Alert>}
        {!loading && reports.length > 0 && (
          <TableContainer>
            <Table aria-label="Backpay reports">
              <TableHead>
                <TableRow>
                  <TableCell>Staff Member</TableCell>
                  <TableCell>Pay Period</TableCell>
                  <TableCell>Report Type</TableCell>
                  <TableCell>Details</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>{report.staffName}</TableCell>
                    <TableCell>{report.payPeriodStartDate} to {report.payPeriodEndDate}</TableCell>
                    <TableCell>{report.reportType === "missing_hours" ? "Missing hours" : "Missing performance input"}</TableCell>
                    <TableCell>{report.reportType === "missing_hours" ? `${report.missingRegularHours} regular hours${report.missingOtHours ? `, ${report.missingOtHours} OT hours` : ""}` : report.description}</TableCell>
                    <TableCell><Chip size="small" color={report.status === "resolved" ? "success" : "warning"} label={formatStatus(report.status)} /></TableCell>
                    <TableCell align="center">
                      {report.status === "pending" && <Button size="small" variant="outlined" onClick={() => resolveReport(report.id)} disabled={loading}>Mark Resolved</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </Box>
  );
}

export default BackpayReportsPage;
