import { alpha, createTheme } from "@mui/material/styles";

const colors = {
  primary: "#7A0000",
  primaryHover: "#990000",
  sidebar: "#111111",
  background: "#F7F7F8",
  paper: "#FFFFFF",
  text: "#181818",
  textSecondary: "#666666",
  border: "#E6E6E6",
  success: "#2E7D32",
  warning: "#ED8B00",
  error: "#C62828",
};

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: colors.primary, dark: "#5F0000", light: colors.primaryHover },
    secondary: { main: colors.textSecondary },
    success: { main: colors.success },
    warning: { main: colors.warning },
    error: { main: colors.error },
    info: { main: "#1565C0" },
    background: { default: colors.background, paper: colors.paper },
    text: { primary: colors.text, secondary: colors.textSecondary },
    divider: colors.border,
    action: {
      hover: alpha(colors.primary, 0.05),
      selected: alpha(colors.primary, 0.09),
      focus: alpha(colors.primary, 0.16),
      disabledBackground: "#EEEEEF",
    },
  },
  typography: {
    fontFamily: 'Inter, "Segoe UI", Roboto, Arial, sans-serif',
    h1: { fontSize: "1.875rem", fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.025em" },
    h2: { fontSize: "1.5rem", fontWeight: 700, lineHeight: 1.3, letterSpacing: "-0.018em" },
    h3: { fontSize: "1.125rem", fontWeight: 700, lineHeight: 1.35 },
    h4: { fontSize: "1rem", fontWeight: 700, lineHeight: 1.4 },
    body1: { fontSize: "0.9375rem", lineHeight: 1.55 },
    body2: { fontSize: "0.875rem", lineHeight: 1.5 },
    caption: { fontSize: "0.75rem", lineHeight: 1.45 },
    button: { fontWeight: 650, textTransform: "none", letterSpacing: 0 },
  },
  shape: { borderRadius: 10 },
  shadows: [
    "none",
    "0 1px 2px rgba(24,24,24,.03), 0 6px 18px rgba(24,24,24,.045)",
    ...Array(23).fill("0 8px 24px rgba(24,24,24,.08)"),
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: colors.background },
        "::selection": { backgroundColor: alpha(colors.primary, 0.16) },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 1 },
      styleOverrides: {
        root: { border: `1px solid ${colors.border}`, borderRadius: 14, backgroundImage: "none" },
      },
    },
    MuiPaper: {
      styleOverrides: { rounded: { borderRadius: 14 } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { minHeight: 40, borderRadius: 10, paddingInline: 18 },
        containedPrimary: {
          "&:hover": { backgroundColor: colors.primaryHover },
          "&.Mui-disabled": { color: "#999999" },
        },
        outlined: {
          borderColor: "#D7D7D7",
          color: colors.text,
          "&:hover": { borderColor: "#C5C5C5", backgroundColor: "#F5F5F5" },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          "&:focus-visible": { outline: `3px solid ${alpha(colors.primary, 0.22)}`, outlineOffset: 2 },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: colors.paper,
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#DADADA" },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#BDBDBD" },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderWidth: 2, borderColor: colors.primary },
        },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { color: colors.textSecondary } } },
    MuiTableContainer: {
      styleOverrides: { root: { borderRadius: 14 } },
    },
    MuiTableHead: {
      styleOverrides: { root: { backgroundColor: "#FAFAFA" } },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: `1px solid ${colors.border}`, padding: "14px 16px" },
        head: { color: colors.text, fontWeight: 700 },
      },
    },
    MuiTableRow: {
      styleOverrides: { root: { "&:hover": { backgroundColor: "#FCFCFC" } } },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 7, fontWeight: 650 },
        colorSuccess: { backgroundColor: alpha(colors.success, 0.12), color: "#1B5E20" },
        colorWarning: { backgroundColor: alpha(colors.warning, 0.14), color: "#8A5100" },
        colorError: { backgroundColor: alpha(colors.error, 0.11), color: "#A71919" },
      },
    },
    MuiAlert: { styleOverrides: { root: { borderRadius: 10, alignItems: "center" } } },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 14, border: `1px solid ${colors.border}`, boxShadow: "0 18px 50px rgba(24,24,24,.14)" },
      },
    },
    MuiDialogTitle: { styleOverrides: { root: { fontWeight: 700 } } },
    MuiMenu: {
      styleOverrides: {
        paper: { marginTop: 6, border: `1px solid ${colors.border}`, boxShadow: "0 10px 30px rgba(24,24,24,.11)" },
      },
    },
    MuiMenuItem: { styleOverrides: { root: { minHeight: 40, borderRadius: 7, marginInline: 6 } } },
    MuiPaginationItem: {
      styleOverrides: {
        root: { borderRadius: 8, "&.Mui-selected": { color: "#FFFFFF", backgroundColor: colors.primary } },
      },
    },
    MuiTooltip: { styleOverrides: { tooltip: { borderRadius: 7, fontSize: "0.75rem" } } },
    MuiSkeleton: { styleOverrides: { root: { borderRadius: 8 } } },
  },
});

export default theme;
