import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Card,
  Chip,
  CircularProgress,
  FormControlLabel,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { CalendarMonthRounded, CheckCircleRounded, ScheduleRounded } from "@mui/icons-material";
import { fetchPayPeriods } from "../api/payPeriods";
import { PageHeader } from "../components/CommonComponents";
import "../styles/rosterSync.css";

function PayPeriodsPage() {
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [showAllPeriods, setShowAllPeriods] = useState(false);
  const today = new Date();
  const windowStart = new Date(today);
  const windowEnd = new Date(today);
  windowStart.setMonth(windowStart.getMonth() - 3);
  windowEnd.setMonth(windowEnd.getMonth() + 3);
  const visiblePeriods = showAllPeriods ? periods : periods.filter((period) => {
    const startDate = new Date(`${period.startDate}T00:00:00`);
    const endDate = new Date(`${period.endDate}T23:59:59`);
    return endDate >= windowStart && startDate <= windowEnd;
  });
  const activePeriod = periods.find((period) => period.isActive);
  const upcomingPeriods = periods.filter((period) => new Date(`${period.startDate}T00:00:00`) > today).length;

  useEffect(() => {
    fetchPayPeriods()
      .then((data) => setPeriods(data))
      .catch((error) => setErrorMessage(error.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box className="page-enter content-page pay-periods-page">
      <PageHeader title="Pay Periods" subtitle="View the automatically generated payroll periods." />
      {errorMessage && <Alert severity="error" className="pay-periods-alert">{errorMessage}</Alert>}

      <Box className="pay-periods-summary-grid" aria-label="Pay period summary">
        <Card className="pay-periods-summary-card"><Box className="pay-periods-summary-icon"><CheckCircleRounded /></Box><Box><Typography className="pay-periods-summary-label">Current period</Typography><Typography className="pay-periods-summary-value">{activePeriod ? "Active" : "None"}</Typography><Typography className="pay-periods-summary-detail">{activePeriod ? `${activePeriod.startDate} to ${activePeriod.endDate}` : "No active payroll period"}</Typography></Box></Card>
        <Card className="pay-periods-summary-card"><Box className="pay-periods-summary-icon is-info"><CalendarMonthRounded /></Box><Box><Typography className="pay-periods-summary-label">In view</Typography><Typography className="pay-periods-summary-value">{visiblePeriods.length}</Typography><Typography className="pay-periods-summary-detail">{showAllPeriods ? "all generated periods" : "within the six-month window"}</Typography></Box></Card>
        <Card className="pay-periods-summary-card"><Box className="pay-periods-summary-icon is-muted"><ScheduleRounded /></Box><Box><Typography className="pay-periods-summary-label">Upcoming</Typography><Typography className="pay-periods-summary-value">{upcomingPeriods}</Typography><Typography className="pay-periods-summary-detail">periods scheduled ahead</Typography></Box></Card>
      </Box>

      <Card className="pay-periods-table-card">
        <Box className="pay-periods-toolbar">
          <Box><Typography component="h2">Payroll Calendar</Typography><Typography className="pay-periods-table-description">Generated periods available for payroll processing.</Typography></Box>
          <FormControlLabel
            control={<Switch checked={showAllPeriods} onChange={(event) => setShowAllPeriods(event.target.checked)} />}
            label="Show all periods"
          />
        </Box>

        {loading && <Box className="pay-periods-loading" role="status" aria-label="Loading pay periods"><CircularProgress /></Box>}
        {!loading && visiblePeriods.length === 0 && <Alert severity="info" className="pay-periods-empty">No pay periods found.</Alert>}
        {!loading && visiblePeriods.length > 0 && (
          <TableContainer>
            <Table aria-label="Pay periods">
              <TableHead>
                <TableRow>
                  <TableCell>Start Date</TableCell>
                  <TableCell>End Date</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visiblePeriods.map((period) => (
                  <TableRow key={period.id} className={period.isActive ? "is-active" : undefined}>
                    <TableCell>{period.startDate}</TableCell>
                    <TableCell>{period.endDate}</TableCell>
                    <TableCell><Typography className="pay-period-range">{period.startDate} to {period.endDate}</Typography></TableCell>
                    <TableCell><Chip size="small" color={period.isActive ? "success" : "default"} label={period.isActive ? "Active" : "Inactive"} /></TableCell>
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

export default PayPeriodsPage;
