import {
  AccessTimeRounded,
  CheckCircleOutlineRounded,
  ErrorOutlineRounded,
  GroupsRounded,
  HistoryRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { useEffect, useMemo, useState } from "react";
import { formatDateTime } from "../utils";

const statusColor = (status) => {
  if (["Matched", "Resolved", "validated", "corrected", "noted"].includes(status)) return "success";
  if (["Flagged", "open", "returned"].includes(status)) return "warning";
  return "default";
};

export function ValidationStatusChip({ status, label }) {
  return <Chip size="small" color={statusColor(status)} label={label || status || "Unknown"} />;
}

function MetricCard({ icon, label, value, supportingText, tone = "primary" }) {
  return <Card className={`validation-summary-card is-${tone}`}><CardContent><Box className="validation-summary-icon">{icon}</Box><Box><Typography className="validation-summary-label">{label}</Typography><Typography className="validation-summary-value">{value}</Typography>{supportingText && <Typography className="validation-summary-description">{supportingText}</Typography>}</Box></CardContent></Card>;
}

export function ValidationSummaryGrid({ review }) {
  return <Box className="validation-summary-grid">
    <MetricCard icon={<GroupsRounded />} label="Staff Reviewed" value={review?.staffReviewed ?? 0} supportingText="Matched employees in this period" />
    <MetricCard icon={<AccessTimeRounded />} label="Total Hours" value={review?.totalHoursValidated ?? 0} supportingText="Matched roster hours" />
    <MetricCard icon={<ErrorOutlineRounded />} label="Open Exceptions" value={review?.discrepancyCount ?? 0} supportingText="Must be resolved before validation" tone={review?.discrepancyCount ? "warning" : "success"} />
    <MetricCard icon={<CheckCircleOutlineRounded />} label="Period Status" value={review?.status || "draft"} supportingText={review?.lastValidatedAt ? `Validated ${formatDateTime(review.lastValidatedAt)}` : "Not yet finalised"} tone={review?.status === "validated" ? "success" : "primary"} />
  </Box>;
}

export function TimesheetReviewTable({ rows, onResolve }) {
  if (!rows.length) return <Box sx={{ py: 5, textAlign: "center" }}><Typography color="text.secondary">No timesheet rows match the current filters.</Typography></Box>;
  return <TableContainer><Table aria-label="Timesheet validation review"><TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Shift entries</TableCell><TableCell align="right">Total hours</TableCell><TableCell>Status</TableCell><TableCell>Exceptions</TableCell><TableCell align="right">Action</TableCell></TableRow></TableHead><TableBody>{rows.map((staff) => {
    const openFlag = (staff.flags || []).find((flag) => ["open", "returned"].includes(flag.status));
    return <TableRow key={staff.staffDbId || `${staff.staffId}-${staff.name}`} hover><TableCell><Typography fontWeight={700}>{staff.name}</Typography><Typography variant="caption" color="text.secondary">{staff.staffId}</Typography></TableCell><TableCell><Box className="validation-shift-list">{(staff.entries || []).map((entry) => <Typography variant="caption" key={entry.id}>{entry.date || "No date"} · {entry.clockIn || "?"}-{entry.clockOut || "?"} · {entry.actualHours}h</Typography>)}</Box></TableCell><TableCell align="right"><strong>{staff.totalHours}</strong></TableCell><TableCell><ValidationStatusChip status={staff.status} /></TableCell><TableCell><Box className="validation-exception-list">{(staff.flags || []).length ? staff.flags.map((flag) => <Box key={flag.id} className="validation-exception-item"><ValidationStatusChip status={flag.status} label={flag.label} /><Typography variant="caption" color="text.secondary">{flag.note}</Typography></Box>) : <Typography variant="caption" color="text.secondary">No exceptions</Typography>}</Box></TableCell><TableCell align="right"><Button size="small" variant="outlined" disabled={!openFlag} onClick={() => onResolve(openFlag, staff)}>{openFlag ? "Review" : "Done"}</Button></TableCell></TableRow>;
  })}</TableBody></Table></TableContainer>;
}

export function ResolveExceptionDialog({ open, item, staff, loading, onClose, onSubmit }) {
  const [resolution, setResolution] = useState("noted");
  const [correctedHours, setCorrectedHours] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setResolution("noted");
      setCorrectedHours(item?.actualValue ?? "");
      setNote("");
    }
  }, [open, item]);

  const correctionAllowed = Boolean(item?.entryId);
  const submit = () => onSubmit({
    resolution,
    correctedHours: resolution === "corrected" && correctedHours !== "" ? Number(correctedHours) : undefined,
    note: note.trim() || undefined,
  });

  return <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="sm"><DialogTitle>Review timesheet exception</DialogTitle><DialogContent><Alert severity="warning" sx={{ mb: 2 }}>{staff?.name || "Employee"}: {item?.note || item?.label}</Alert><FormControl fullWidth margin="normal"><InputLabel>Resolution</InputLabel><Select value={resolution} label="Resolution" onChange={(event) => setResolution(event.target.value)}><MenuItem value="noted">Confirm / note as acceptable</MenuItem>{correctionAllowed && <MenuItem value="corrected">Correct recorded hours</MenuItem>}<MenuItem value="returned">Return for follow-up</MenuItem></Select></FormControl>{resolution === "corrected" && <TextField label="Corrected hours" type="number" value={correctedHours} onChange={(event) => setCorrectedHours(event.target.value)} inputProps={{ min: 0, max: 24, step: 0.25 }} fullWidth margin="normal" />}<TextField label="Supervisor note" value={note} onChange={(event) => setNote(event.target.value)} multiline minRows={3} fullWidth margin="normal" /></DialogContent><DialogActions sx={{ p: 2.5 }}><Button onClick={onClose} disabled={loading} color="inherit">Cancel</Button><Button variant="contained" onClick={submit} disabled={loading || (resolution === "corrected" && correctedHours === "")}>Save resolution</Button></DialogActions></Dialog>;
}

export function ValidationAuditPanel({ entries }) {
  const sorted = useMemo(() => [...(entries || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [entries]);
  return <Card className="validation-audit-card"><CardContent><Box className="validation-card-heading"><Box><Typography variant="h2">Validation history</Typography><Typography color="text.secondary">Audit activity for the selected pay period.</Typography></Box><HistoryRounded color="primary" /></Box>{sorted.length ? <Box className="validation-audit-list">{sorted.map((entry, index) => <Box className="validation-audit-row" key={`${entry.action}-${entry.createdAt}-${index}`}><Box><Typography fontWeight={700}>{entry.action?.replaceAll("_", " ")}</Typography><Typography variant="caption" color="text.secondary">{entry.actor || "system"}</Typography></Box><Typography variant="caption" color="text.secondary">{formatDateTime(entry.createdAt)}</Typography></Box>)}</Box> : <Typography color="text.secondary" sx={{ mt: 2 }}>No validation history recorded yet.</Typography>}</CardContent></Card>;
}
