import { useEffect, useState } from "react";
import { fetchPayPeriods } from "../api/payPeriods";
import "../styles/rosterSync.css";

function PayPeriodsPage() {
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [showAllPeriods, setShowAllPeriods] = useState(false);
  const today = new Date();
  const windowStart = new Date(today);
  const windowEnd = new Date(today);
  windowStart.setMonth(windowStart.getMonth() - 3);
  windowEnd.setMonth(windowEnd.getMonth() + 3);
  const visiblePeriods = showAllPeriods ? periods : periods.filter((period) => {
    const startDate = new Date(`${period.startDate}T00:00:00`);
    const endDate = new Date(`${period.endDate}T23:59:59`);
    return endDate >= windowStart && startDate <= windowEnd;
  });

  useEffect(() => {
    fetchPayPeriods()
      .then((data) => setPeriods(data))
      .catch((error) => setErrorMessage(error.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="roster-page">
      <header className="roster-intro"><h1>Pay Periods</h1><p>View the automatically generated payroll periods.</p></header>
      {errorMessage && <p className="roster-banner roster-error">{errorMessage}</p>}
      <section className="roster-card">
        <h2>Pay Periods</h2>
        <label className="roster-controls"><input type="checkbox" checked={showAllPeriods} onChange={(event) => setShowAllPeriods(event.target.checked)} />Show all periods</label>
        {loading && <p className="roster-empty">Loading pay periods...</p>}
        {!loading && visiblePeriods.length === 0 && <p className="roster-empty">No pay periods found.</p>}
        {!loading && visiblePeriods.length > 0 && <div className="roster-table-scroll"><table><thead><tr><th>Start date</th><th>End date</th><th>Status</th></tr></thead><tbody>{visiblePeriods.map((period) => <tr key={period.id} style={period.isActive ? { background: "#dcfce7", fontWeight: 700 } : undefined}><td>{period.startDate}</td><td>{period.endDate}</td><td>{period.isActive ? "Active" : "Inactive"}</td></tr>)}</tbody></table></div>}
      </section>
    </main>
  );
}

export default PayPeriodsPage;
