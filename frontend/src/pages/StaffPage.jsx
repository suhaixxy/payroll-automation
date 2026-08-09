import { useCallback, useEffect, useState } from "react";
import { GroupsRounded, PersonAddRounded, PersonOffRounded, WorkOutlineRounded } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
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
import { createStaff, deactivateStaff, getStaff, updateStaff } from "../api/staff";
import { PageHeader } from "../components/CommonComponents";
import { formatStatus } from "../utils";
import "../styles/rosterSync.css";

const emptyStaff = { external_ref: "", full_name: "", employment_type: "part_time", department: "", role: "", email: "", phone: "", date_joined: "", max_weekly_hours: "", status: "active" };

function StaffPage() {
  const [staff, setStaff] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState(emptyStaff);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      setStaff(await getStaff(statusFilter));
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const updateForm = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const openAddForm = () => {
    setEditingId(null);
    setForm(emptyStaff);
    setShowForm(true);
    setErrorMessage("");
  };

  const openEditForm = (member) => {
    setEditingId(member.id);
    setForm({
      external_ref: member.externalRef,
      full_name: member.fullName,
      employment_type: member.employmentType,
      department: member.department || "",
      role: member.role || "",
      email: member.email || "",
      phone: member.phone || "",
      date_joined: member.dateJoined || "",
      max_weekly_hours: member.maxWeeklyHours ?? "",
      status: member.status,
    });
    setShowForm(true);
    setErrorMessage("");
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyStaff);
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await updateStaff(editingId, {
          full_name: form.full_name,
          employment_type: form.employment_type,
          department: form.department,
          role: form.role,
          email: form.email,
          phone: form.phone,
          date_joined: form.date_joined,
          max_weekly_hours: form.employment_type === "part_time" && form.max_weekly_hours !== "" ? Number(form.max_weekly_hours) : null,
          status: form.status,
        });
      } else {
        await createStaff({
          external_ref: form.external_ref,
          full_name: form.full_name,
          employment_type: form.employment_type,
          department: form.department,
          role: form.role,
          email: form.email,
          phone: form.phone,
          date_joined: form.date_joined,
          max_weekly_hours: form.employment_type === "part_time" && form.max_weekly_hours !== "" ? Number(form.max_weekly_hours) : null,
        });
      }
      closeForm();
      await loadStaff();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const deactivate = async (id) => {
    setLoading(true);
    try {
      await deactivateStaff(id);
      await loadStaff();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="page-enter content-page staff-page">
      <PageHeader
        title="Staff"
        subtitle="Manage the people and employment details used by roster synchronisation."
        actions={<Button variant="contained" startIcon={<PersonAddRounded />} onClick={openAddForm} disabled={loading}>Add Staff</Button>}
      />

      <Box className="staff-summary-grid" aria-label="Staff summary">
        <Card className="staff-summary-card"><CardContent><Box className="staff-summary-icon"><GroupsRounded /></Box><Box><Typography className="staff-summary-label">Showing</Typography><Typography className="staff-summary-value">{staff.length}</Typography><Typography className="staff-summary-detail">{statusFilter ? "active staff members" : "staff records"}</Typography></Box></CardContent></Card>
        <Card className="staff-summary-card"><CardContent><Box className="staff-summary-icon is-success"><WorkOutlineRounded /></Box><Box><Typography className="staff-summary-label">Active</Typography><Typography className="staff-summary-value">{staff.filter((member) => member.status === "active").length}</Typography><Typography className="staff-summary-detail">available for rostering</Typography></Box></CardContent></Card>
        <Card className="staff-summary-card"><CardContent><Box className="staff-summary-icon is-muted"><PersonOffRounded /></Box><Box><Typography className="staff-summary-label">Inactive</Typography><Typography className="staff-summary-value">{staff.filter((member) => member.status !== "active").length}</Typography><Typography className="staff-summary-detail">not currently rostered</Typography></Box></CardContent></Card>
      </Box>

      <Card className="staff-filter-card">
        <CardContent className="staff-filter-content">
          <Box><Typography className="staff-filter-title">Directory view</Typography><Typography className="staff-filter-description">Filter the employee directory by employment status.</Typography></Box>
          <FormControl size="small" className="staff-status-filter" sx={{ width: { xs: "100%", sm: 220 }, flexShrink: 0 }}>
            <InputLabel id="staff-status-label">Status</InputLabel>
            <Select labelId="staff-status-label" id="staff-status" label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} disabled={loading}>
              <MenuItem value="">All staff</MenuItem>
              <MenuItem value="active">Active only</MenuItem>
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {errorMessage && <Alert severity="error" className="staff-alert">{errorMessage}</Alert>}

      {showForm && (
        <Card className="staff-form-card">
          <CardContent>
            <Typography component="h2">{editingId ? "Edit Staff" : "Add Staff"}</Typography>
            <Box component="form" className="staff-form-grid" onSubmit={submitForm}>
              <TextField size="small" label="External reference" id="staff-external-ref" name="external_ref" value={form.external_ref} onChange={updateForm} disabled={Boolean(editingId) || loading} required />
              <TextField size="small" label="Name" id="staff-full-name" name="full_name" value={form.full_name} onChange={updateForm} disabled={loading} required />
              <FormControl size="small">
                <InputLabel id="staff-employment-type-label">Employment type</InputLabel>
                <Select labelId="staff-employment-type-label" id="staff-employment-type" label="Employment type" name="employment_type" value={form.employment_type} onChange={updateForm} disabled={loading}>
                  <MenuItem value="full_time">Full time</MenuItem>
                  <MenuItem value="part_time">Part time</MenuItem>
                </Select>
              </FormControl>
              <TextField size="small" label="Department" id="staff-department" name="department" value={form.department} onChange={updateForm} disabled={loading} />
              <TextField size="small" label="Role" id="staff-role" name="role" value={form.role} onChange={updateForm} disabled={loading} />
              <TextField size="small" label="Email" id="staff-email" name="email" value={form.email} onChange={updateForm} disabled={loading} />
              <TextField size="small" label="Phone" id="staff-phone" name="phone" value={form.phone} onChange={updateForm} disabled={loading} />
              <TextField size="small" label="Date joined" id="staff-date-joined" name="date_joined" type="date" value={form.date_joined} onChange={updateForm} disabled={loading} slotProps={{ inputLabel: { shrink: true } }} />
              {form.employment_type === "part_time" && (
                <TextField
                  size="small"
                  label="Weekly availability (hours)"
                  helperText="Optional cap used when planning part-time shifts."
                  id="staff-max-weekly-hours"
                  name="max_weekly_hours"
                  type="number"
                  inputProps={{ min: 0, step: 0.5 }}
                  value={form.max_weekly_hours}
                  onChange={updateForm}
                  disabled={loading}
                />
              )}
              {editingId && (
                <FormControl size="small">
                  <InputLabel id="staff-status-edit-label">Status</InputLabel>
                  <Select labelId="staff-status-edit-label" id="staff-status-edit" label="Status" name="status" value={form.status} onChange={updateForm} disabled={loading}>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                  </Select>
                </FormControl>
              )}
              <Box className="staff-form-actions">
                <Button type="submit" variant="contained" disabled={loading}>{editingId ? "Save Changes" : "Create Staff"}</Button>
                <Button type="button" variant="outlined" color="inherit" onClick={closeForm} disabled={loading}>Cancel</Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      <Card className="staff-table-card">
        <Box className="staff-table-heading"><Box><Typography component="h2">Staff Directory</Typography><Typography className="staff-table-description">Employment details and roster availability.</Typography></Box><Chip size="small" label={`${staff.length} record${staff.length === 1 ? "" : "s"}`} variant="outlined" /></Box>
        {loading && <Box className="staff-loading" role="status" aria-label="Loading staff"><CircularProgress /></Box>}
        {!loading && staff.length === 0 && <Alert severity="info" className="staff-empty">No staff records found.</Alert>}
        {!loading && staff.length > 0 && (
          <TableContainer>
            <Table aria-label="Staff records">
              <TableHead>
                <TableRow>
                  <TableCell>Staff ID</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Employment Type</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Date Joined</TableCell>
                  <TableCell align="right">Weekly Availability</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {staff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell><Typography className="staff-external-ref">{member.externalRef}</Typography></TableCell>
                    <TableCell>{member.fullName}</TableCell>
                    <TableCell>{formatStatus(member.employmentType)}</TableCell>
                    <TableCell>{member.department || "—"}</TableCell>
                    <TableCell>{member.role || "—"}</TableCell>
                    <TableCell>{member.email || "—"}</TableCell>
                    <TableCell>{member.phone || "—"}</TableCell>
                    <TableCell>{member.dateJoined || "—"}</TableCell>
                    <TableCell align="right">{member.employmentType === "part_time" && member.maxWeeklyHours != null ? `${member.maxWeeklyHours} hrs` : "—"}</TableCell>
                    <TableCell><Chip size="small" color={member.status === "active" ? "success" : "default"} label={formatStatus(member.status)} /></TableCell>
                    <TableCell align="center">
                      <Box className="staff-row-actions">
                        <Button size="small" variant="outlined" onClick={() => openEditForm(member)}>Edit</Button>
                        {member.status === "active" && <Button size="small" variant="outlined" color="error" onClick={() => deactivate(member.id)}>Deactivate</Button>}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </Box>
  );
}

export default StaffPage;
