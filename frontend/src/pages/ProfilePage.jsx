import { EmailRounded, PersonRounded, SecurityRounded } from "@mui/icons-material";
import { Avatar, Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { PageHeader } from "../components/CommonComponents";
import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const { user } = useAuth();
  return <Box className="page-enter content-page"><PageHeader title="Profile" subtitle="Your authenticated payroll account." /><Card sx={{ maxWidth: 720 }}><CardContent sx={{ p: 4 }}><Stack direction={{ xs: "column", sm: "row" }} spacing={3} alignItems={{ sm: "center" }}><Avatar sx={{ width: 76, height: 76, bgcolor: "primary.main" }}><PersonRounded sx={{ fontSize: 42 }} /></Avatar><Box><Typography variant="h2">{user.fullName}</Typography><Chip size="small" color="primary" label={user.role} sx={{ mt: 1, textTransform: "capitalize" }} /></Box></Stack><Box className="profile-details"><EmailRounded color="action" /><Box><Typography variant="caption" color="text.secondary">Email</Typography><Typography>{user.email}</Typography></Box><SecurityRounded color="action" /><Box><Typography variant="caption" color="text.secondary">Access</Typography><Typography>{user.role === "manager" ? "Payment management and all payslips" : "Own payslips only"}</Typography></Box></Box></CardContent></Card></Box>;
}
