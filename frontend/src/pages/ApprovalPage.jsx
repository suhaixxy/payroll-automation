import { useEffect, useState } from "react";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";

const money = new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" });
const label = (value) => (value || "").replaceAll("_", " ");
const fmtDate = (v) => new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

async function request(path, options) {
  const response = await apiClient.request({ url: `/approvals${path}`, ...options });
  return response.data;
}

function ApprovalPage() {
  const { user } = useAuth();
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState("");
  const [summary, setSummary] = useState(null);
  const [selectedLine, setSelectedLine] = useState(null);
  const [decision, setDecision] = useState("approved");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadPeriods(); }, []);
  useEffect(() => { if (periodId) loadSummary(periodId); }, [periodId]);

  async function loadPeriods() {
    try {
      setLoading(true);
      const data = await request("/periods");
      setPeriods(data);
      setPeriodId(data.find((period) => period.status === "pending_approval")?.id || data[0]?.id || "");
    } catch (error) {
      setMessage({ type: "error", text: `Could not load payroll periods: ${error.message}` });
    } finally { setLoading(false); }
  }

  async function loadSummary(id = periodId) {
    try {
      setLoading(true);
      setSummary(await request(`/summary?payPeriodId=${encodeURIComponent(id)}`));
    } catch (error) {
      setMessage({ type: "error", text: `Could not load payroll summary: ${error.message}` });
    } finally { setLoading(false); }
  }

  async function showLine(lineId) {
    try { setSelectedLine(await request(`/lines/${lineId}`)); }
    catch (error) { setMessage({ type: "error", text: error.message }); }
  }

  async function submitDecision(event) {
    event.preventDefault();
    try {
      const result = await request("/", {
        method: "POST",
        data: { payPeriodId: periodId, calculationRunId: summary.calculationRunId, decision, comment },
      });
      setMessage({ type: "success", text: decision === "approved" ? `Payroll approved by ${result.approvedBy}.` : "Payroll rejected and returned for calculation." });
      setComment("");
      await Promise.all([loadPeriods(), loadSummary()]);
    } catch (error) { setMessage({ type: "error", text: error.message }); }
  }

  return <main className="approval-page">
    <style>{styles + groupStyles}</style>
    <header><p className="eyebrow">UC-004 · Manager workspace</p><h1>Review & approve payroll</h1><p>Review calculated pay, inspect an employee line, then record your decision.</p></header>
    {message && <div className={`message ${message.type}`}>{message.text}</div>}
    <section className="toolbar"><label>Payroll cycle
      <select value={periodId} onChange={(event) => setPeriodId(event.target.value)} disabled={!periods.length}>
        {periods.map((period) => <option key={period.id} value={period.id}>{fmtDate(period.startDate)} – {fmtDate(period.endDate)} · {label(period.status)}</option>)}
      </select>
    </label></section>
    {loading && <p>Loading payroll information…</p>}
    {!loading && !periods.length && <p>No payroll periods are available for review.</p>}
    {summary && <>
      <section className="cards">
        <article><span>Total gross</span><strong>{money.format(summary.totalGross || 0)}</strong></article>
        <article><span>Total net</span><strong>{money.format(summary.totalNet || 0)}</strong></article>
        <article><span>Previous cycle net</span><strong>{summary.previousCycle.totalNet == null ? "No previous cycle" : money.format(summary.previousCycle.totalNet)}</strong></article>
        <article><span>Current status</span><strong className={`status ${summary.status}`}>{label(summary.status)}</strong></article>
      </section>
      <section className="panel"><h2>Employee payroll breakdown</h2><p>Inspect an employee line before recording a decision.</p>
        <table><thead><tr><th>Employee</th><th>Gross pay</th><th>Incentive</th><th>CPF</th><th>SDL</th><th>Net pay</th><th>Status</th><th /></tr></thead>
          <tbody>{summary.lines.map((line) => <tr key={line.id}><td>{line.fullName}</td><td>{money.format(line.grossPay || 0)}</td><td>{money.format(line.incentivePay || 0)}</td><td>{money.format(line.cpfAmount || 0)}</td><td>{money.format(line.sdlAmount || 0)}</td><td>{money.format(line.netPay || 0)}</td><td><span className={`status ${line.status}`}>{label(line.status)}</span></td><td><button className="secondary" onClick={() => showLine(line.id)}>View details</button></td></tr>)}</tbody>
        </table>
      </section>
      {summary.status === "pending_approval" && <section className="panel decision"><h2>Record decision</h2><form onSubmit={submitDecision}>
        <label>Approver<input value={user?.fullName || user?.email || "Authenticated manager"} readOnly /></label>
        <label>Decision<select value={decision} onChange={(event) => setDecision(event.target.value)}><option value="approved">Approve payroll</option><option value="rejected">Reject payroll</option></select></label>
        {decision === "rejected" && <label>Reason for rejection<textarea value={comment} onChange={(event) => setComment(event.target.value)} required placeholder="Explain what needs to be corrected" /></label>}
        <button type="submit" className={decision === "approved" ? "approve" : "reject"}>{decision === "approved" ? "Approve payroll" : "Reject payroll"}</button>
      </form></section>}
    </>}
    {selectedLine && <div className="modal-backdrop" onClick={() => setSelectedLine(null)}><section className="modal" onClick={(event) => event.stopPropagation()}>
      <button className="close" onClick={() => setSelectedLine(null)} aria-label="Close">×</button><h2>{selectedLine.fullName}</h2><p>{label(selectedLine.employmentType)}</p>
      <div className="details"><span>Hours</span><b>{selectedLine.totalHours}</b><span>Overtime hours</span><b>{selectedLine.otHours}</b><span>Public-holiday hours</span><b>{selectedLine.phHours}</b><span>Gross + incentive</span><b>{money.format(Number(selectedLine.grossPay) + Number(selectedLine.incentivePay))}</b><span>Deductions (CPF + SDL)</span><b>{money.format(Number(selectedLine.cpfAmount) + Number(selectedLine.sdlAmount))}</b><span>Net pay</span><b>{money.format(selectedLine.netPay)}</b></div>
      <h3>Performance inputs</h3>{selectedLine.performanceInputs.length ? <ul>{selectedLine.performanceInputs.map((item) => <li key={item.metricType}>{item.metricType}: {item.metricValue}</li>)}</ul> : <p>No performance inputs required for this employee.</p>}
    </section></div>}
  </main>;
}

const styles = `.approval-page{max-width:1200px;margin:0 auto;padding:48px 24px 72px;text-align:left;color:#17233d}.approval-page h1{margin:4px 0 10px;font-size:2.3rem}.approval-page h2{margin-top:0}.approval-page .eyebrow{color:#5169a5;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:.75rem}.toolbar,.panel,.cards article{background:#fff;border:1px solid #e2e8f4;border-radius:12px;box-shadow:0 3px 14px #1b2b5010}.toolbar{margin:26px 0 18px;padding:16px}.approval-page label{display:grid;gap:7px;font-weight:650}.approval-page select,.approval-page input,.approval-page textarea{padding:10px;border:1px solid #bec9dc;border-radius:7px;background:#fff}.toolbar select{margin-left:10px;min-width:330px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:18px 0}.cards article{padding:17px;display:grid;gap:8px}.cards span{color:#60708d;font-size:.88rem}.cards strong{font-size:1.25rem}.panel{padding:22px;margin-top:18px;overflow-x:auto}.panel table{width:100%;border-collapse:collapse;text-align:left}.panel th,.panel td{padding:13px 9px;border-bottom:1px solid #e7edf5}.panel th{color:#596983;font-size:.78rem;text-transform:uppercase}.status{display:inline-block;border-radius:999px;padding:4px 8px;font-size:.75rem;background:#e8edf5;text-transform:capitalize}.status.pending_approval{background:#fff1c7;color:#775600}.status.approved,.status.ok{background:#dff5e6;color:#19643a}.status.pending_calculation,.status.incomplete{background:#fce5e6;color:#a5232b}.approval-page button{cursor:pointer;border:0;border-radius:7px;padding:10px 14px;color:#fff;background:#2d56aa;font-weight:650}.approval-page button.secondary{background:#edf2ff;color:#294c98;padding:7px 10px}.approval-page button.approve{background:#167243}.approval-page button.reject{background:#ba2936}.decision form{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:end}.decision form label:nth-child(3){grid-column:1/-1}.approval-page textarea{min-height:80px;resize:vertical}.message{padding:13px 16px;border-radius:8px;margin-top:20px}.message.success{background:#dcf5e4;color:#195d36}.message.error{background:#fde4e6;color:#8b1b25}.modal-backdrop{position:fixed;inset:0;background:#111b327a;display:grid;place-items:center;padding:20px;z-index:1}.modal{position:relative;width:min(560px,100%);background:#fff;padding:28px;border-radius:14px}.approval-page button.close{position:absolute;right:14px;top:12px;background:none;color:#41506a;font-size:1.7rem;padding:3px 10px}.details{display:grid;grid-template-columns:1fr auto;gap:11px;padding:16px 0}.details span{color:#5f6e87}@media(max-width:760px){.cards{grid-template-columns:1fr 1fr}.decision form{grid-template-columns:1fr}.toolbar select{display:block;margin:7px 0 0;min-width:100%}}`;

const groupStyles = `
  .approval-page { max-width: 1440px; min-height: 100%; margin: 0 auto; padding: 38px 32px 56px; color: #181818; background: #f7f7f8; font-family: Inter, "Segoe UI", Roboto, Arial, sans-serif; }
  .approval-page h1 { color: #7a0000; font-size: 2rem; letter-spacing: -.03em; }.approval-page h2 { font-size: 1.08rem; }.approval-page h3 { font-size: .88rem; }.approval-page .eyebrow { color: #7a0000; font-weight: 750; letter-spacing: .12em; }.approval-page header > p:last-child { color: #666; }
  .approval-page .toolbar, .approval-page .panel, .approval-page .cards article { border-color: #e5e7eb; border-radius: 10px; box-shadow: 0 5px 18px rgba(24,24,24,.045); }.approval-page .toolbar { margin: 24px 0 16px; padding: 18px; }.approval-page label { color: #252a34; font-size: .88rem; font-weight: 700; }.approval-page select, .approval-page input, .approval-page textarea { border-color: #d7d9dd; color: #181818; }
  .approval-page .cards { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; margin: 16px 0; }.approval-page .cards article { min-height: 130px; padding: 22px; align-content: center; }.approval-page .cards span { color: #3f3f3f; font-size: .8rem; }.approval-page .cards strong { font-size: 1.55rem; }
  .approval-page .panel { padding: 20px 18px 18px; margin-top: 16px; }.approval-page .panel > p { color: #666; font-size: .85rem; }.approval-page .panel th, .approval-page .panel td { padding: 12px 10px; border-color: #ededed; }.approval-page .panel th { color: #555; background: #fafafa; font-size: .72rem; font-weight: 750; }
  .approval-page .status { color: #555; background: #eceff3; font-size: .72rem; font-weight: 700; }.approval-page .status.pending_approval { color: #9a5d00; background: #fff1d6; }.approval-page .status.approved, .approval-page .status.ok { color: #20843d; background: #e2f5e7; }.approval-page .status.pending_calculation, .approval-page .status.incomplete { color: #b51d1d; background: #fde7e7; }
  .approval-page button { background: #7a0000; font-size: .82rem; font-weight: 700; }.approval-page button:hover { background: #990000; }.approval-page button.secondary { border: 1px solid #d9c1c1; color: #7a0000; background: #fff; }.approval-page button.secondary:hover { background: #fff7f7; }.approval-page button.approve { background: #7a0000; }.approval-page button.reject { background: #b51d1d; }
  .approval-page .message.success { color: #19643a; background: #e2f5e7; }.approval-page .message.error { color: #8b1b25; background: #fde7e7; }.approval-page .modal-backdrop { background: rgba(17,17,17,.55); }.approval-page .modal { border-radius: 12px; box-shadow: 0 12px 38px rgba(24,24,24,.14); }.approval-page button.close { color: #555; }
  @media (max-width: 760px) { .approval-page { padding: 28px 16px 40px; }.approval-page .cards { grid-template-columns: 1fr 1fr; gap: 12px; }.approval-page .panel { padding: 16px 12px; } }
`;

export default ApprovalPage;
