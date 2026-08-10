import { useState } from "react";
import { Alert, Box, Button, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { formatDateTime } from "../utils";

function SyncHistoryList({ history }) {
  const [showAll, setShowAll] = useState(false);
  if (!history?.length) return <Alert severity="info">No sync history yet for this pay period.</Alert>;

  const visibleHistory = showAll ? history : history.slice(0, 5);

  return (
    <TableContainer className="roster-sync-history-table">
      <Table aria-label="Sync history">
        <TableHead>
          <TableRow>
            <TableCell>Status</TableCell>
            <TableCell>Triggered By</TableCell>
            <TableCell>Detail</TableCell>
            <TableCell>Time</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {visibleHistory.map((entry, index) => {
            const failed = entry.action === "roster_sync_failed";
            const actor = entry.actor === "scheduler" ? "Automatic" : "Manual (Import Now)";
            return (
              <TableRow key={`${entry.createdAt}-${index}`}>
                <TableCell><Chip size="small" color={failed ? "error" : "success"} label={failed ? "Failed" : "Synced"} /></TableCell>
                <TableCell>{actor}</TableCell>
                <TableCell>{failed ? entry.detail?.reason : `${entry.detail?.staffSynced ?? 0} staff, ${entry.detail?.totalHours ?? 0}h`}</TableCell>
                <TableCell>{formatDateTime(entry.createdAt)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {history.length > 5 && (
        <Box className="roster-sync-history-actions">
          <Button size="small" variant="text" onClick={() => setShowAll((current) => !current)}>
            {showAll ? "Show recent history" : `See full history (${history.length})`}
          </Button>
        </Box>
      )}
    </TableContainer>
  );
}

export default SyncHistoryList;
