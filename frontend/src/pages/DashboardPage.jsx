import {
  ArrowForwardIosRounded,
  CalendarMonthRounded,
  DescriptionRounded,
  GroupsRounded,
  LinkRounded,
  MoreVertRounded,
  PaymentsRounded,
  PersonSearchRounded,
  ReceiptLongRounded,
  SyncRounded,
  WarningAmberRounded,
} from "@mui/icons-material";
import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPaymentBatches, getPaymentStatistics } from "../api/paymentApi";
import { ErrorState, PageHeader, StatusChip } from "../components/CommonComponents";
import { formatCurrency, formatDateTime, formatPeriod, getErrorMessage, sortByTimestampsNewestFirst } from "../utils";

const quickActions = [
  {
    title: "Prepare Payment",
    description: "Go to payment dashboard to process payroll",
    path: "/payments/preview",
    icon: <DescriptionRounded />,
  },
  {
    title: "Payment Batches",
    description: "View and manage all payment batches",
    path: "/payments",
    icon: <PaymentsRounded />,
  },
  {
    title: "Payslips",
    description: "Access and download employee payslips",
    path: "/payslips",
    icon: <PersonSearchRounded />,
  },
];

const dashboardStatusLabel = (status) => ({
  hrms_sync_failed: "Sync Failed",
}[status]);

const formatPayPeriodDate = (value) => {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
};

const formatPeriodStatus = (status) => status
  ? status.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ")
  : null;

function DashboardSummaryCard({ icon, label, value, description, loading, badge, periodRange }) {
  return (
    <Card className={`dashboard-summary-card${periodRange ? " dashboard-summary-card-pay-period" : ""}`}>
      <CardContent>
        <Box className="dashboard-summary-icon" aria-hidden="true">{icon}</Box>
        <Box className="dashboard-summary-copy">
          <Typography className="dashboard-summary-label">{label}</Typography>
          {loading ? <Skeleton width={115} height={38} /> : periodRange ? (
            <Typography component="div" className="dashboard-summary-value dashboard-period-range">
              <span>{periodRange.start}</span>
              <span aria-hidden="true">–</span>
              <span>{periodRange.end}</span>
            </Typography>
          ) : <Typography className="dashboard-summary-value">{value}</Typography>}
          {badge && <Chip size="small" color="success" label={badge} className="dashboard-period-chip" />}
          <Typography className="dashboard-summary-description">{description}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [statistics, setStatistics] = useState(null);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [stats, batchResult] = await Promise.all([
        getPaymentStatistics(),
        getPaymentBatches({ limit: 100 }),
      ]);
      setStatistics(stats);
      setBatches(batchResult.rows || []);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to load the operational Dashboard."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const recentBatches = sortByTimestampsNewestFirst(
    batches,
    (batch) => batch.generatedAt ?? batch.createdAt,
  ).slice(0, 3);
  const successfulSyncs = batches.filter((batch) => batch.hrmsSyncStatus === "completed" && batch.hrmsSyncedAt);
  const latestSuccessfulSync = successfulSyncs
    .map((batch) => batch.hrmsSyncedAt)
    .sort((a, b) => new Date(b) - new Date(a))[0];
  const latestPaymentBatch = batches.find((batch) => batch.status !== "cancelled");
  const pendingRetries = batches.filter((batch) => batch.hrmsSyncStatus === "failed" || batch.status === "hrms_sync_failed").length;
  const isHrmsConnected = batches.some((batch) => batch.hrmsSyncStatus === "completed");
  const summary = statistics?.summary;
  const currentPayPeriod = summary?.currentPayPeriod;

  return (
    <Box className="page-enter content-page dashboard-page">
      <PageHeader title="Dashboard" subtitle="Monitor the payroll process and HRMS delivery across all pay periods." />
      {error && <ErrorState message={error} onRetry={load} />}

      <Box className="dashboard-summary-grid">
        <DashboardSummaryCard
          icon={<GroupsRounded />}
          label="Total Staff"
          value={summary?.activeStaff ?? 0}
          description="Active employees in payroll"
          loading={loading}
        />
        <DashboardSummaryCard
          icon={<CalendarMonthRounded />}
          label="Current Pay Period"
          periodRange={currentPayPeriod ? {
            start: formatPayPeriodDate(currentPayPeriod.startDate),
            end: formatPayPeriodDate(currentPayPeriod.endDate),
          } : null}
          value="No active period"
          badge={formatPeriodStatus(currentPayPeriod?.status)}
          description={currentPayPeriod ? "Payroll in progress" : "No pay period covers today"}
          loading={loading}
        />
        <DashboardSummaryCard
          icon={<ReceiptLongRounded />}
          label="Payment Batches"
          value={summary?.currentYearBatchCount ?? 0}
          description="Generated this year"
          loading={loading}
        />
        <DashboardSummaryCard
          icon={<GroupsRounded />}
          label="Pending Approvals"
          value={summary?.pendingApprovals ?? 0}
          description="Awaiting manager approval"
          loading={loading}
        />
      </Box>

      <Card className="dashboard-section-card dashboard-batches-card">
        <Box className="dashboard-section-heading">
          <Typography component="h2">Recent Payment Batches</Typography>
          <button type="button" className="dashboard-view-all" onClick={() => navigate("/payments")}>
            View All <ArrowForwardIosRounded />
          </button>
        </Box>
        <TableContainer>
          <Table aria-label="Recent payroll batches">
            <TableHead>
              <TableRow>
                <TableCell>Batch ID</TableCell>
                <TableCell>Pay Period</TableCell>
                <TableCell align="right">Employees</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Total Amount</TableCell>
                <TableCell>Created At</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && Array.from({ length: 3 }, (_, index) => (
                <TableRow key={index}>{Array.from({ length: 7 }, (__, cellIndex) => <TableCell key={cellIndex}><Skeleton /></TableCell>)}</TableRow>
              ))}
              {!loading && recentBatches.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell className="dashboard-batch-reference">{batch.batchReference}</TableCell>
                  <TableCell>{batch.payPeriod ? formatPeriod(batch.payPeriod.startDate, batch.payPeriod.endDate) : "Period unavailable"}</TableCell>
                  <TableCell align="right">{batch.employeeCount}</TableCell>
                  <TableCell><StatusChip status={batch.status} label={dashboardStatusLabel(batch.status)} /></TableCell>
                  <TableCell align="right">{formatCurrency(batch.totalAmount)}</TableCell>
                  <TableCell>{formatDateTime(batch.generatedAt)}</TableCell>
                  <TableCell align="center">
                    <IconButton size="small" aria-label={`View ${batch.batchReference}`} onClick={() => navigate(`/payments/${batch.id}`)}>
                      <MoreVertRounded />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && recentBatches.length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" className="dashboard-empty-row">No payroll batches have been generated.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Box className="dashboard-lower-grid">
        <Card className="dashboard-section-card">
          <Box className="dashboard-section-heading"><Typography component="h2">Quick Actions</Typography></Box>
          <Box className="dashboard-actions-grid">
            {quickActions.map((action) => (
              <button key={action.title} type="button" className="dashboard-action" onClick={() => navigate(action.path)}>
                <Box className="dashboard-action-icon" aria-hidden="true">{action.icon}</Box>
                <Box className="dashboard-action-title">
                  <Typography component="span">{action.title}</Typography>
                  <ArrowForwardIosRounded />
                </Box>
                <Typography>{action.description}</Typography>
              </button>
            ))}
          </Box>
        </Card>

        <Card className="dashboard-section-card">
          <Box className="dashboard-section-heading"><Typography component="h2">System Status</Typography></Box>
          <Box className="dashboard-status-list">
            <Box className="dashboard-status-row">
              <Box className="dashboard-status-label"><Box className="dashboard-status-icon"><LinkRounded /></Box><Typography>HRMS Connection</Typography></Box>
              {loading ? <Skeleton width={90} /> : <Box className={`dashboard-connection ${isHrmsConnected ? "is-connected" : ""}`}><span />{isHrmsConnected ? "Connected" : "No recent sync"}</Box>}
            </Box>
            <Box className="dashboard-status-row">
              <Box className="dashboard-status-label"><Box className="dashboard-status-icon"><SyncRounded /></Box><Typography>Last Successful Sync</Typography></Box>
              <Typography>{loading ? "Loading…" : formatDateTime(latestSuccessfulSync)}</Typography>
            </Box>
            <Box className="dashboard-status-row">
              <Box className="dashboard-status-label"><Box className="dashboard-status-icon"><DescriptionRounded /></Box><Typography>Latest Payment File</Typography></Box>
              <Typography>{loading ? "Loading…" : latestPaymentBatch ? `${latestPaymentBatch.batchReference}.csv` : "Not available"}</Typography>
            </Box>
            <Box className="dashboard-status-row">
              <Box className="dashboard-status-label"><Box className="dashboard-status-icon"><WarningAmberRounded /></Box><Typography>Pending HRMS Retries</Typography></Box>
              <Typography>{loading ? "…" : pendingRetries}</Typography>
            </Box>
          </Box>
        </Card>
      </Box>
    </Box>
  );
}
