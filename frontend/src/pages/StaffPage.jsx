import { useEffect, useState } from "react";
import { createStaff, deactivateStaff, getStaff, updateStaff } from "../api/staff";
import "../styles/rosterSync.css";

const emptyStaff = { external_ref: "", full_name: "", employment_type: "part_time", status: "active" };

function StaffPage() {
  const [staff, setStaff] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState(emptyStaff);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadStaff = async () => {
    setLoading(true);
    try {
      setStaff(await getStaff(statusFilter));
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, [statusFilter]);

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
          status: form.status,
        });
      } else {
        await createStaff({
          external_ref: form.external_ref,
          full_name: form.full_name,
          employment_type: form.employment_type,
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
    <main className="roster-page">
      <header className="roster-intro"><h1>Staff</h1><p>Manage staff records used by roster synchronisation.</p></header>
      <section className="roster-controls">
        <label htmlFor="staff-status">Status</label>
        <select id="staff-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} disabled={loading}>
          <option value="">All staff</option>
          <option value="active">Active only</option>
        </select>
        <button type="button" className="roster-primary" onClick={openAddForm} disabled={loading}>Add Staff</button>
      </section>
      {errorMessage && <p className="roster-banner roster-error">{errorMessage}</p>}
      {showForm && (
        <section className="roster-card">
          <h2>{editingId ? "Edit Staff" : "Add Staff"}</h2>
          <form className="roster-controls" onSubmit={submitForm}>
            <label htmlFor="staff-external-ref">External reference</label>
            <input id="staff-external-ref" name="external_ref" value={form.external_ref} onChange={updateForm} disabled={Boolean(editingId) || loading} required />
            <label htmlFor="staff-full-name">Name</label>
            <input id="staff-full-name" name="full_name" value={form.full_name} onChange={updateForm} disabled={loading} required />
            <label htmlFor="staff-employment-type">Employment type</label>
            <select id="staff-employment-type" name="employment_type" value={form.employment_type} onChange={updateForm} disabled={loading}>
              <option value="full_time">Full time</option>
              <option value="part_time">Part time</option>
            </select>
            {editingId && <><label htmlFor="staff-status-edit">Status</label><select id="staff-status-edit" name="status" value={form.status} onChange={updateForm} disabled={loading}><option value="active">Active</option><option value="inactive">Inactive</option></select></>}
            <button type="submit" className="roster-primary" disabled={loading}>{editingId ? "Save Changes" : "Create Staff"}</button>
            <button type="button" className="roster-secondary" onClick={closeForm} disabled={loading}>Cancel</button>
          </form>
        </section>
      )}
      <section className="roster-card">
        <h2>Staff Records</h2>
        {loading && <p className="roster-empty">Loading staff...</p>}
        {!loading && staff.length === 0 && <p className="roster-empty">No staff records found.</p>}
        {!loading && staff.length > 0 && <div className="roster-table-scroll"><table><thead><tr><th>Name</th><th>Employment type</th><th>Status</th><th>Actions</th></tr></thead><tbody>{staff.map((member) => <tr key={member.id}><td>{member.fullName}</td><td>{member.employmentType.replace("_", " ")}</td><td>{member.status}</td><td><button type="button" className="roster-secondary" onClick={() => openEditForm(member)}>Edit</button>{member.status === "active" && <button type="button" className="roster-secondary" onClick={() => deactivate(member.id)}>Deactivate</button>}</td></tr>)}</tbody></table></div>}
      </section>
    </main>
  );
}

export default StaffPage;
