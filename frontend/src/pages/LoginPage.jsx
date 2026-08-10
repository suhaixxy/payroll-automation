import { yupResolver } from "@hookform/resolvers/yup";
import { EmailOutlined, LockOutlined, VisibilityOffRounded, VisibilityRounded } from "@mui/icons-material";
import { Alert, Box, Button, Card, CardContent, CircularProgress, IconButton, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import * as yup from "yup";
import { useAuth } from "../context/AuthContext";

const schema = yup.object({
  email: yup.string().trim().email("Enter a valid email address").required("Email is required"),
  password: yup.string().min(8, "Password must contain at least 8 characters").required("Password is required"),
});

const loginErrorMessage = (error) => {
  if (error.response) {
    const payload = error.response.data;
    const code = payload?.error?.code || payload?.error;

    if (code === "INVALID_CREDENTIALS") return "Invalid email or password.";

    return payload?.error?.message || payload?.message || "Unable to sign in. Please try again.";
  }

  if (error.request) return "Cannot reach the payroll server. Please try again.";

  return "Unable to sign in. Please try again.";
};

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: yupResolver(schema), defaultValues: { email: "", password: "" },
  });

  if (loading) return <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "#7A0000" }}><CircularProgress sx={{ color: "white" }} /></Box>;
  if (user) return <Navigate to={user.role === "manager" ? "/dashboard" : "/payslips"} replace />;

  const onSubmit = async (values) => {
    setServerError("");
    try {
      const signedInUser = await signIn({ email: values.email.trim(), password: values.password });
      const requestedPath = location.state?.from?.pathname;
      navigate(signedInUser.role === "employee" ? "/payslips" : (requestedPath || "/dashboard"), { replace: true });
    } catch (error) {
      setServerError(loginErrorMessage(error));
    }
  };

  return (
    <Box component="main" className="login-page">
      <Box className="login-brand-panel">
        <Box className="login-circle-lines" aria-hidden="true" />
        <Box className="login-panel-orb" aria-hidden="true" />
        <Box className="login-dot-grid login-dot-grid-brand" aria-hidden="true" />
        <Box className="login-brand-content">
          <Typography className="login-eyebrow">PAYROLL AUTOMATION SYSTEM</Typography>
          <Box className="login-accent-line" aria-hidden="true" />
          <Typography component="h1" className="login-hero-title">
            Emergencies<br />First Aid &amp;<br />Rescue (EFAR)
          </Typography>
          <Typography className="login-hero-copy">
            Supporting healthcare professionals<br className="login-copy-break" />
            with secure, accurate and efficient<br className="login-copy-break" />
            payroll management.
          </Typography>
        </Box>
        <Box className="login-wave" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => <span key={index} />)}
        </Box>
        <Box className="login-footer">
          <Typography>© 2026 Emergencies First Aid &amp; Rescue</Typography>
          <Typography>Version 1.0</Typography>
        </Box>
      </Box>
      <Box className="login-form-panel">
        <Box className="login-form-wrap">
          <Box className="login-form-heading">
            <Typography component="h2">Login</Typography>
            <Typography>Sign in to continue to your account</Typography>
          </Box>
          <Card className="login-card">
            <CardContent className="login-card-content">
          {serverError && <Alert severity="error" sx={{ mb: 2 }} role="alert">{serverError}</Alert>}
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                <Stack spacing={1} className="login-field-group">
                  <Typography component="label" htmlFor="login-email" className="login-field-label">
                    Email address <span aria-hidden="true">*</span>
                  </Typography>
                  <Controller name="email" control={control} render={({ field }) => (
                    <TextField
                      {...field}
                      id="login-email"
                      type="email"
                      placeholder="Enter your email"
                      fullWidth
                      error={Boolean(errors.email)}
                      helperText={errors.email?.message}
                      autoComplete="email"
                      autoFocus
                      slotProps={{ input: { startAdornment: <InputAdornment position="start"><EmailOutlined /></InputAdornment> } }}
                    />
                  )} />
                </Stack>
                <Stack spacing={1} className="login-field-group">
                  <Typography component="label" htmlFor="login-password" className="login-field-label">
                    Password <span aria-hidden="true">*</span>
                  </Typography>
            <Controller name="password" control={control} render={({ field }) => (
                    <TextField
                      {...field}
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      fullWidth
                      error={Boolean(errors.password)}
                      helperText={errors.password?.message}
                      autoComplete="current-password"
                      slotProps={{ input: {
                        startAdornment: <InputAdornment position="start"><LockOutlined /></InputAdornment>,
                        endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowPassword((value) => !value)} edge="end" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <VisibilityOffRounded /> : <VisibilityRounded />}</IconButton></InputAdornment>,
                      } }}
                    />
            )} />
                </Stack>
                <Button type="submit" variant="contained" size="large" fullWidth disabled={isSubmitting} className="login-submit">
                  {isSubmitting && <CircularProgress size={18} color="inherit" />}
                  {isSubmitting ? "LOGGING IN..." : "LOG IN"}
            </Button>
          </Box>
        </CardContent>
      </Card>
        </Box>
        <Box className="login-dot-grid login-dot-grid-form" aria-hidden="true" />
      </Box>
    </Box>
  );
}
