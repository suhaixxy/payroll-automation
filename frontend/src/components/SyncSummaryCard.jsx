import { AccessTimeRounded, GroupsRounded, UpdateRounded, WarningAmberRounded } from "@mui/icons-material";
import { Box, Card, CardContent, Typography } from "@mui/material";
import { formatDateTime } from "../utils";

function SyncMetric({ icon, label, value, tone = "primary" }) {
  return (
    <Card className={`roster-sync-metric is-${tone}`}>
      <CardContent>
        <Box className="roster-sync-metric-icon">{icon}</Box>
        <Box>
          <Typography className="roster-sync-metric-label">{label}</Typography>
          <Typography className="roster-sync-metric-value">{value}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

function SyncSummaryCard({ summary }) {
  if (!summary || !summary.success) return null;

  const lastSynced = summary.syncedAt ? formatDateTime(summary.syncedAt) : "—";

  return (
    <Box className="roster-sync-metrics">
      <SyncMetric icon={<GroupsRounded />} label="Staff Synced" value={summary.staffSynced} />
      <SyncMetric icon={<AccessTimeRounded />} label="Total Hours" value={summary.totalHours} />
      <SyncMetric icon={<WarningAmberRounded />} label="Unmatched" value={summary.unmatchedCount} tone={summary.unmatchedCount ? "warning" : "success"} />
      <SyncMetric icon={<UpdateRounded />} label="Last Synced" value={lastSynced} />
    </Box>
  );
}

export default SyncSummaryCard;
