import { InboxRounded } from "@mui/icons-material";
import { Alert, alpha, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Skeleton, Typography } from "@mui/material";
import { formatStatus } from "../utils";

function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", onConfirm, onClose, loading = false, danger = false, children }) {
  return <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="confirm-dialog-title"><DialogTitle id="confirm-dialog-title">{title}</DialogTitle><DialogContent>{message && <DialogContentText>{message}</DialogContentText>}{children}</DialogContent><DialogActions sx={{ p: 2.5 }}><Button onClick={onClose} disabled={loading} color="inherit">Cancel</Button><Button onClick={onConfirm} disabled={loading} color={danger ? "error" : "primary"} variant="contained" startIcon={loading ? <CircularProgress size={17} color="inherit" /> : null}>{confirmLabel}</Button></DialogActions></Dialog>;
}

function EmptyState({ title = "No records found", message }) {
  return <Box sx={{ textAlign: "center", py: 7, px: 2, color: "text.secondary" }}><InboxRounded sx={{ fontSize: 48, color: "#CBD5E1" }} /><Typography variant="h3" color="text.primary" sx={{ mt: 1 }}>{title}</Typography>{message && <Typography sx={{ mt: 0.7 }}>{message}</Typography>}</Box>;
}

function ErrorState({ message, onRetry }) {
  return <Alert severity="error" action={onRetry ? <Button color="inherit" size="small" onClick={onRetry}>Retry</Button> : null}>{message}</Alert>;
}

function PageHeader({ title, subtitle, actions }) {
  return <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" }, flexDirection: { xs: "column", sm: "row" }, gap: 2, mb: 3 }}><Box><Typography variant="h1">{title}</Typography>{subtitle && <Typography color="text.secondary" sx={{ mt: 0.7 }}>{subtitle}</Typography>}</Box>{actions && <Box>{actions}</Box>}</Box>;
}

const statusColors = {
  completed: "success", ready: "success", approved: "success", payment_ready: "success",
  failed: "error", hrms_sync_failed: "error", blocked: "error", cancelled: "default",
  pending: "warning", hrms_sync_pending: "warning", generating: "info", generated: "info",
};

function StatusChip({ status, size = "small", label, className }) {
  return <Chip className={className} size={size} color={statusColors[status] || "default"} variant={status === "cancelled" ? "outlined" : "filled"} label={label || formatStatus(status)} />;
}

function SummaryCard({ icon, label, value, supportingText, loading = false, color = "primary.main" }) {
  return <Card sx={{ height: "100%" }}><CardContent sx={{ p: 2.5 }}><Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}><Box><Typography variant="body2" color="text.secondary">{label}</Typography>{loading ? <Skeleton width={90} height={42} /> : <Typography variant="h2" sx={{ mt: 0.7 }}>{value}</Typography>}{supportingText && <Typography variant="caption" color="text.secondary">{supportingText}</Typography>}</Box><Box sx={(theme) => ({ color, bgcolor: alpha(theme.palette[color.split(".")[0]]?.main || theme.palette.primary.main, 0.1), width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: 2 })}>{icon}</Box></Box></CardContent></Card>;
}

export { ConfirmDialog, EmptyState, ErrorState, PageHeader, StatusChip, SummaryCard };
