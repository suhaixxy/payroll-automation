import { Box, Button, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

export default function NotFoundPage() { const navigate = useNavigate(); return <Box sx={{ textAlign: "center", py: 10 }}><Typography variant="h1">Page not found</Typography><Typography color="text.secondary" sx={{ my: 2 }}>The requested payroll page does not exist.</Typography><Button variant="contained" onClick={() => navigate("/dashboard")}>Return to dashboard</Button></Box>; }
