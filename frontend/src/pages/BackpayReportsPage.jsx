import { useCallback, useEffect, useState } from "react";
import { createBackpayReport, fetchBackpayReports, resolveBackpayReport } from "../api/backpay";
import { fetchPayPeriods } from "../api/roster";
import { getStaff } from "../api/staff";
import "../styles/rosterSync.css";

const emptyForm = { staff_id: "", pay_period_id: "", missing_regular_hours: "", missing_ot_hours: "", description: "" };

function BackpayReportsPage() {
  const [reports, setReports] = useState([]);
  const [staff, setStaff] = useState([]);
  const [payPeriods, setPayPeriods] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedStaff = staff.find((member) => member.id === form.staff_id);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [nextStaff, nextPayPeriods, nextReports] = await Promise.all([
        getStaff("active"),
        fetchPayPeriods(),
        fetchBackpayReports(statusFilter ? { status: statusFilter } : {}),
      ]);
      setStaff(nextStaff);
      setPayPeriods(nextPayPeriods);
      setReports(nextReports);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateForm = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const openForm = () => {
    setForm(emptyForm);
    setShowForm(true);
    setErrorMessage("");
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const data = {
        staff_id: form.staff_id,
        pay_period_id: form.pay_period_id,
      };
      if (selectedStaff?.employmentType === "part_time") {
        data.missing_regular_hours = form.missing_regular_hours;
        if (form.missing_ot_hours) data.missing_ot_hours = form.missing_ot_hours;
      } else {
        data.description = form.description;
      }
      await createBackpayReport(data);
      setForm(emptyForm);
      setShowForm(false);
      await loadData();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const resolveReport = async (id) => {
    setLoading(true);
    try {
      await resolveBackpayReport(id);
      await loadData();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="roster-page">
      <header className="roster-intro"><h1>Backpay Reports</h1><p>Record and track missed pay for past pay periods.</p></header>
      <section className="roster-controls">
        <label htmlFor="backpay-status">Status</label>
        <select id="backpay-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} disabled={loading}>
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
        </select>
        <button type="button" className="roster-primary" onClick={openForm} disabled={loading}>Report Missing Pay</button>
      </section>
      {errorMessage && <p className="roster-banner roster-error">{errorMessage}</p>}
      {showForm && <section className="roster-card">
        <h2>Report Missing Pay</h2>
        <form className="roster-controls" onSubmit={submitForm}>
          <label htmlFor="backpay-staff">Staff member</label>
          <select id="backpay-staff" name="staff_id" value={form.staff_id} onChange={updateForm} disabled={loading} required>
            <option value="">Select active staff</option>
            {staff.map((member) => <option key={member.id} value={member.id}>{member.fullName}</option>)}
          </select>
          <label htmlFor="backpay-pay-period">Pay period</label>
          <select id="backpay-pay-period" name="pay_period_id" value={form.pay_period_id} onChange={updateForm} disabled={loading} required>
            <option value="">Select pay period</option>
            {payPeriods.map((period) => <option key={period.id} value={period.id}>{period.startDate} to {period.endDate}</option>)}
          </select>
          {selectedStaff?.employmentType === "part_time" && <>
            <label htmlFor="backpay-regular-hours">Missing regular hours</label>
            <input id="backpay-regular-hours" name="missing_regular_hours" type="number" value={form.missing_regular_hours} onChange={updateForm} disabled={loading} required />
            <label htmlFor="backpay-ot-hours">Missing OT hours</label>
            <input id="backpay-ot-hours" name="missing_ot_hours" type="number" value={form.missing_ot_hours} onChange={updateForm} disabled={loading} />
          </>}
          {selectedStaff?.employmentType === "full_time" && <>
            <label htmlFor="backpay-description">Missing performance input</label>
            <textarea id="backpay-description" name="description" value={form.description} onChange={updateForm} disabled={loading} required />
          </>}
          <button type="submit" className="roster-primary" disabled={loading || !selectedStaff}>Create Report</button>
          <button type="button" className="roster-secondary" onClick={() => setShowForm(false)} disabled={loading}>Cancel</button>
        </form>
      </section>}
      <section className="roster-card">
        <h2>Backpay Reports</h2>
        {loading && <p className="roster-empty">Loading backpay reports...</p>}
        {!loading && reports.length === 0 && <p className="roster-empty">No backpay reports found.</p>}
        {!loading && reports.length > 0 && <div className="roster-table-scroll"><table><thead><tr><th>Staff member</th><th>Pay period</th><th>Report type</th><th>Details</th><th>Status</th><th>Actions</th></tr></thead><tbody>{reports.map((report) => <tr key={report.id}><td>{report.staffName}</td><td>{report.payPeriodStartDate} to {report.payPeriodEndDate}</td><td>{report.reportType === "missing_hours" ? "Missing hours" : "Missing performance input"}</td><td>{report.reportType === "missing_hours" ? `${report.missingRegularHours} regular hours${report.missingOtHours ? `, ${report.missingOtHours} OT hours` : ""}` : report.description}</td><td>{report.status}</td><td>{report.status === "pending" && <button type="button" className="roster-secondary" onClick={() => resolveReport(report.id)} disabled={loading}>Mark Resolved</button>}</td></tr>)}</tbody></table></div>}
      </section>
    </main>
  );
}

export default BackpayReportsPage;
