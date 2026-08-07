import {
  AccountCircleRounded,
  CalculateRounded,
  DashboardRounded,
  DescriptionRounded,
  ExpandLessRounded,
  ExpandMoreRounded,
  FactCheckRounded,
  GroupsRounded,
  LogoutRounded,
  MenuRounded,
  PaymentsRounded,
  PersonRounded,
  PlaylistAddCheckRounded,
  ReceiptLongRounded,
  SyncAltRounded,
  TodayRounded,
  TimerRounded,
} from "@mui/icons-material";
import {
  AppBar,
  Avatar,
  Box,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const drawerWidth = 270;

const paymentLinks = [
  { label: "Payment Preview", path: "/payments/preview", icon: <PlaylistAddCheckRounded /> },
  { label: "Payment Batches", path: "/payments", icon: <ReceiptLongRounded /> },
  { label: "Payslips", path: "/payslips", icon: <DescriptionRounded /> },
];

const pageTitles = [
  { match: /^\/dashboard$/, title: "Dashboard" },
  { match: /^\/payments\/preview$/, title: "Payment Preview" },
  { match: /^\/payments\/review-employees$/, title: "Review Employees" },
  { match: /^\/payments\/[^/]+$/, title: "Payment Batch Details" },
  { match: /^\/payments$/, title: "Payment Batches" },
  { match: /^\/payslips\/[^/]+$/, title: "Payslip Details" },
  { match: /^\/payslips$/, title: "Payslips" },
  { match: /^\/profile$/, title: "Profile" },
];

function SidebarLink({ icon, label, path, active, onNavigate, nested = false }) {
  return (
    <ListItemButton
      component={NavLink}
      to={path}
      end
      onClick={onNavigate}
      className={`sidebar-link${active ? " sidebar-link-active" : ""}${nested ? " sidebar-sublink" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText primary={label} />
    </ListItemButton>
  );
}

function Sidebar({ onNavigate }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isManager = user?.role === "manager";
  const isPaymentRoute =
    paymentLinks.some(({ path }) => location.pathname === path) ||
    /^\/payments\/[^/]+$/.test(location.pathname);
  const [paymentsOpen, setPaymentsOpen] = useState(isPaymentRoute);

  useEffect(() => {
    if (isPaymentRoute) setPaymentsOpen(true);
  }, [isPaymentRoute]);

  const logout = async () => {
    await signOut();
    onNavigate?.();
    navigate("/login", { replace: true });
  };

  return (
    <Box className="sidebar-content">
      <Box className="brand-lockup">
        <Typography className="brand-name">EFAR</Typography>
        <Typography className="brand-subtitle">Payroll Automation System</Typography>
      </Box>
      <Divider className="sidebar-divider" />
      <List component="nav" aria-label="Primary navigation" className="sidebar-nav">
        {isManager && (
          <>
            <SidebarLink icon={<DashboardRounded />} label="Dashboard" path="/dashboard" active={location.pathname === "/dashboard"} onNavigate={onNavigate} />
            <SidebarLink icon={<SyncAltRounded />} label="Roster Sync" path="/roster" active={location.pathname === "/roster"} onNavigate={onNavigate} />
            <SidebarLink icon={<TimerRounded />} label="Timesheet Validation" path="/timesheets" active={location.pathname === "/timesheets"} onNavigate={onNavigate} />
            <SidebarLink icon={<CalculateRounded />} label="Payroll Calc" path="/payroll" active={location.pathname === "/payroll"} onNavigate={onNavigate} />
            <SidebarLink icon={<FactCheckRounded />} label="Approvals" path="/approvals" active={location.pathname === "/approvals"} onNavigate={onNavigate} />
            <ListItemButton className="sidebar-link sidebar-link-unavailable" disabled>
              <ListItemIcon><GroupsRounded /></ListItemIcon>
              <ListItemText primary="Employees" secondary="Not available" />
            </ListItemButton>
            <ListItemButton className="sidebar-link sidebar-link-unavailable" disabled>
              <ListItemIcon><TodayRounded /></ListItemIcon>
              <ListItemText primary="Pay Periods" secondary="Not available" />
            </ListItemButton>
            <ListItemButton
              className={`sidebar-link sidebar-parent-link${isPaymentRoute ? " sidebar-parent-active" : ""}`}
              onClick={() => setPaymentsOpen((open) => !open)}
              aria-expanded={paymentsOpen}
              aria-controls="payments-navigation"
            >
              <ListItemIcon><PaymentsRounded /></ListItemIcon>
              <ListItemText primary="Payments" />
              {paymentsOpen ? <ExpandLessRounded fontSize="small" /> : <ExpandMoreRounded fontSize="small" />}
            </ListItemButton>
            <Collapse in={paymentsOpen} timeout={180} unmountOnExit>
              <List id="payments-navigation" component="div" disablePadding className="sidebar-submenu">
                {paymentLinks.map((link) => {
                  const active = location.pathname === link.path;
                  return <SidebarLink key={link.path} {...link} active={active} onNavigate={onNavigate} nested />;
                })}
              </List>
            </Collapse>
          </>
        )}
        {!isManager && <SidebarLink icon={<DescriptionRounded />} label="Payslips" path="/payslips" active={location.pathname === "/payslips"} onNavigate={onNavigate} />}
        <SidebarLink icon={<AccountCircleRounded />} label="Profile" path="/profile" active={location.pathname === "/profile"} onNavigate={onNavigate} />
      </List>
      <Box className="sidebar-logout">
        <ListItemButton className="sidebar-link" onClick={logout}>
          <ListItemIcon><LogoutRounded /></ListItemIcon>
          <ListItemText primary="Logout" />
        </ListItemButton>
      </Box>
    </Box>
  );
}

function TopBar({ onMenuClick, navigationOpen, isDesktop }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [anchor, setAnchor] = useState(null);
  const pageTitle = pageTitles.find(({ match }) => match.test(location.pathname))?.title || "EFAR Payroll";
  const displayName = user?.fullName || user?.name || "EFAR User";
  const displayRole = user?.role || "User";
  const initials = displayName.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "EU";

  const handleLogout = async () => {
    setAnchor(null);
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <AppBar position="fixed" color="inherit" elevation={0} className="app-topbar">
      <Toolbar>
        <IconButton
          className="topbar-menu-button"
          edge="start"
          onClick={onMenuClick}
          aria-label={navigationOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={navigationOpen}
          aria-controls={isDesktop ? "desktop-navigation" : "mobile-navigation"}
        >
          <MenuRounded />
        </IconButton>
        <Typography className="topbar-page-title" component="h1">{pageTitle}</Typography>
        <Box className="topbar-account">
          <IconButton
            onClick={(event) => setAnchor(event.currentTarget)}
            aria-label="Open account menu"
            aria-haspopup="menu"
            aria-expanded={Boolean(anchor)}
          >
            <Avatar className="topbar-avatar">{initials}</Avatar>
          </IconButton>
          <Box className="topbar-user-copy">
            <Typography variant="body2" fontWeight={700}>{displayName}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: "capitalize" }}>{displayRole}</Typography>
          </Box>
          <IconButton className="topbar-account-arrow" size="small" onClick={(event) => setAnchor(event.currentTarget)} aria-label="Open account menu">
            <ExpandMoreRounded fontSize="small" />
          </IconButton>
        </Box>
        <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
          <MenuItem disabled><PersonRounded fontSize="small" sx={{ mr: 1 }} />{user?.email || displayName}</MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout}><LogoutRounded fontSize="small" sx={{ mr: 1 }} />Log out</MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}

export default function AppLayout() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (isDesktop) setMobileOpen(false);
  }, [isDesktop]);

  const handleMenuClick = () => {
    if (isDesktop) {
      setDesktopCollapsed((collapsed) => !collapsed);
    } else {
      setMobileOpen((open) => !open);
    }
  };

  const navigationOpen = isDesktop ? !desktopCollapsed : mobileOpen;

  return (
    <Box className={`application-shell${isDesktop && desktopCollapsed ? " sidebar-collapsed" : ""}`}>
      <TopBar onMenuClick={handleMenuClick} navigationOpen={navigationOpen} isDesktop={isDesktop} />
      <Box component="nav" aria-label="Application navigation">
        {isDesktop ? (
          !desktopCollapsed && (
            <Drawer
              id="desktop-navigation"
              variant="permanent"
              open
              sx={{ "& .MuiDrawer-paper": { width: drawerWidth } }}
            >
              <Sidebar />
            </Drawer>
          )
        ) : (
          <Drawer
            id="mobile-navigation"
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: false }}
            sx={{ "& .MuiDrawer-paper": { width: drawerWidth } }}
          >
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </Drawer>
        )}
      </Box>
      <Box component="main" className="application-main"><Outlet /></Box>
    </Box>
  );
}
