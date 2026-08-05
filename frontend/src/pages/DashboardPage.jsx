import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api/client";
import { IconCalendar, IconClipboardCheck, IconGrid, IconActivity } from "../components/icons";

const workflow = [
  { code: "UC-001", title: "Roster Sync", text: "Import and review the latest roster.", path: "/roster" },
  { code: "UC-002", title: "Timesheet Validation", text: "Resolve timesheet exceptions before calculation.", path: "/timesheets" },
  { code: "UC-003", title: "Payroll Calculation", text: "Calculate gross pay, deductions and net pay.", path: "/payroll" },
  { code: "UC-004", title: "Approval", text: "Review and approve a completed payroll cycle.", path: "/approvals" },
];

const money = new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" });
const dateFormatter = new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short", year: "numeric" });
const label = (value) => (value || "").replaceAll("_", " ");
const formatDate = (value) => (value ? dateFormatter.format(new Date(value)) : "—");

function DashboardPage() {
  const [health, setHealth] = useState("checking");
  const [periods, setPeriods] = useState(null);
  const [periodsError, setPeriodsError] = useState("");

  useEffect(() => {
    apiGet("/health").then(() => setHealth("connected")).catch(() => setHealth("unavailable"));
    apiGet("/api/approvals/periods")
      .then(setPeriods)
      .catch(() => setPeriodsError("Payroll period data is not available right now."));
  }, []);

  const pendingApprovals = periods?.filter((period) => period.status === "pending_approval").length ?? null;
  const currentPeriod = periods?.[0] ?? null;
  const recentPeriods = periods?.slice(0, 5) ?? [];

  return <main className="dashboard-page">
    <style>{styles}</style>
    <header className="dashboard-header">
      <p className="dashboard-kicker">Payroll automation system</p>
      <h1>Dashboard</h1>
      <p>Monitor the payroll workflow and continue with the next task.</p>
    </header>

    <section className="dashboard-summary-grid" aria-label="System summary">
      <article>
        <span className="summary-icon"><IconCalendar /></span>
        <div>
          <p>Current pay period</p>
          <strong>{currentPeriod ? `${formatDate(currentPeriod.startDate)} – ${formatDate(currentPeriod.endDate)}` : periods ? "No periods yet" : "…"}</strong>
          <small>{currentPeriod ? label(currentPeriod.status) : "Awaiting payroll data"}</small>
        </div>
      </article>
      <article>
        <span className="summary-icon"><IconClipboardCheck /></span>
        <div>
          <p>Pending approvals</p>
          <strong>{pendingApprovals ?? "…"}</strong>
          <small>{pendingApprovals ? "Awaiting manager approval" : pendingApprovals === 0 ? "All caught up" : "Loading"}</small>
        </div>
      </article>
      <article>
        <span className="summary-icon"><IconGrid /></span>
        <div>
          <p>Payroll periods</p>
          <strong>{periods ? periods.length : "…"}</strong>
          <small>Recorded in the system</small>
        </div>
      </article>
      <article>
        <span className="summary-icon"><IconActivity /></span>
        <div>
          <p>System status</p>
          <strong className={health === "connected" ? "status-good" : ""}>{health === "checking" ? "Checking" : health === "connected" ? "Online" : "Unavailable"}</strong>
          <small>Backend connection</small>
        </div>
      </article>
    </section>

    <section className="dashboard-card">
      <div className="dashboard-card-heading">
        <div><h2>Recent payroll periods</h2><p>Latest pay cycles and their approval status.</p></div>
        <Link className="view-all" to="/approvals">View all &rarr;</Link>
      </div>
      {periodsError && <p className="dashboard-empty">{periodsError}</p>}
      {!periodsError && periods && !periods.length && <p className="dashboard-empty">No payroll periods have been recorded yet.</p>}
      {!periodsError && recentPeriods.length > 0 && <div className="table-scroll">
        <table>
          <thead><tr><th>Pay period</th><th>Status</th><th>Total gross</th><th>Total net</th><th>Decided</th></tr></thead>
          <tbody>
            {recentPeriods.map((period) => <tr key={period.id}>
              <td>{formatDate(period.startDate)} – {formatDate(period.endDate)}</td>
              <td><span className={`status ${period.status}`}>{label(period.status)}</span></td>
              <td>{period.totalGross != null ? money.format(period.totalGross) : "—"}</td>
              <td>{period.totalNet != null ? money.format(period.totalNet) : "—"}</td>
              <td>{formatDate(period.decidedAt)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>}
    </section>

    <section className="dashboard-card">
      <div className="dashboard-card-heading"><div><h2>Payroll workflow</h2><p>Complete each step in sequence to prepare payroll for payment.</p></div></div>
      <div className="workflow-grid">
        {workflow.map((item, index) => <Link className="workflow-item" key={item.code} to={item.path}>
          <span className="workflow-number">{index + 1}</span><div><small>{item.code}</small><h3>{item.title}</h3><p>{item.text}</p></div><span className="workflow-arrow">&rarr;</span>
        </Link>)}
      </div>
    </section>

    <section className="dashboard-card dashboard-help">
      <div><h2>Getting started</h2><p>Start with Roster Sync, then validate timesheets and calculate payroll before submitting it for approval.</p></div>
      <Link to="/roster">Start workflow</Link>
    </section>
  </main>;
}

const styles = `
  .dashboard-page{min-height:100%;padding:32px 32px 56px;text-align:left;color:#181818;font-family:Inter,"Segoe UI",Roboto,Arial,sans-serif}.dashboard-header{margin:0 0 28px}.dashboard-kicker{color:#7a0000;font-size:.72rem;font-weight:750;letter-spacing:.13em;text-transform:uppercase}.dashboard-header h1{margin:5px 0 8px;color:#7a0000;font-size:2rem;letter-spacing:-.03em}.dashboard-header>p:last-child{color:#666}.dashboard-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;margin-bottom:18px}.dashboard-summary-grid article,.dashboard-card{border:1px solid #e5e7eb;border-radius:10px;background:#fff;box-shadow:0 5px 18px rgba(24,24,24,.045)}.dashboard-summary-grid article{min-height:145px;padding:22px;display:flex;gap:16px}.summary-icon{width:47px;height:47px;display:grid;place-items:center;flex:0 0 auto;border-radius:50%;color:#9b0909;background:#fde9e9}.dashboard-summary-grid p{color:#3f3f3f;font-size:.8rem}.dashboard-summary-grid strong{display:block;margin-top:4px;font-size:1.3rem;line-height:1.25}.dashboard-summary-grid small{display:block;margin-top:8px;color:#666;font-size:.72rem}.status-good{color:#20843d}.dashboard-card{padding:0 18px 18px;margin-top:18px}.dashboard-card-heading{min-height:78px;display:flex;align-items:center;justify-content:space-between;gap:14px}.dashboard-card h2{margin:0;color:#181818;font-size:1.08rem}.dashboard-card-heading p{margin-top:4px;color:#666;font-size:.8rem}.view-all{flex:0 0 auto;color:#7a0000;font-size:.8rem;font-weight:700;text-decoration:none;white-space:nowrap}.view-all:hover{text-decoration:underline}.dashboard-empty{padding:20px 2px;color:#666;font-size:.85rem}.table-scroll{overflow-x:auto}.dashboard-card table{width:100%;border-collapse:collapse;text-align:left}.dashboard-card th,.dashboard-card td{padding:12px 10px;border-bottom:1px solid #ededed;white-space:nowrap}.dashboard-card th{color:#555;background:#fafafa;font-size:.72rem;font-weight:750;text-transform:uppercase}.status{display:inline-block;border-radius:999px;padding:4px 9px;font-size:.72rem;font-weight:700;background:#eceff3;color:#555;text-transform:capitalize}.status.pending_approval{background:#fff1d6;color:#9a5d00}.status.approved{background:#e2f5e7;color:#20843d}.status.pending_calculation{background:#fde7e7;color:#b51d1d}.workflow-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.workflow-item{min-height:136px;padding:18px;display:grid;grid-template-columns:auto 1fr auto;gap:14px;border:1px solid #e6e6e6;border-radius:9px;color:#181818;text-decoration:none;transition:background .15s,border-color .15s,transform .15s}.workflow-item:hover{border-color:rgba(122,0,0,.35);background:#fffafa;transform:translateY(-1px)}.workflow-number{width:31px;height:31px;display:grid;place-items:center;border-radius:50%;color:#9b0909;background:#fde9e9;font-size:.78rem;font-weight:800}.workflow-item small{color:#7a0000;font-size:.65rem;font-weight:800;letter-spacing:.07em}.workflow-item h3{margin:4px 0 6px;font-size:.92rem}.workflow-item p{color:#666;font-size:.73rem;line-height:1.55}.workflow-arrow{align-self:center;color:#7a0000;font-weight:800}.dashboard-help{min-height:108px;display:flex;align-items:center;justify-content:space-between;gap:24px}.dashboard-help p{margin-top:7px;color:#666;font-size:.82rem}.dashboard-help a{padding:10px 14px;border-radius:7px;color:#fff;background:#7a0000;font-size:.82rem;font-weight:700;text-decoration:none;white-space:nowrap}.dashboard-help a:hover{background:#990000}@media(max-width:1080px){.dashboard-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:760px){.dashboard-page{padding:24px 16px 40px}.dashboard-summary-grid,.workflow-grid{grid-template-columns:1fr}.dashboard-card-heading{flex-direction:column;align-items:flex-start;min-height:auto}.dashboard-help{align-items:flex-start;flex-direction:column;padding-top:20px}.dashboard-help a{margin-top:auto}}
`;

export default DashboardPage;
