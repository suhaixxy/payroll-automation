const { pool } = require("../config/database");

function validationError(body = {}) {
  if (!body.payPeriodId || !body.calculationRunId || !["approved", "rejected"].includes(body.decision)) {
    return { error: "VALIDATION_ERROR", message: "payPeriodId, calculationRunId, and an approved or rejected decision are required." };
  }
  if (body.decision === "rejected" && !String(body.comment || "").trim()) {
    return { error: "COMMENT_REQUIRED", message: "A comment is required when rejecting a payroll period." };
  }
  return null;
}

const authoritativeRunSql = `
  SELECT r.id, r.run_number, r.total_gross, r.total_net_payable,
         r.lines_complete, r.lines_incomplete, r.run_at
  FROM calculation_runs r
  WHERE r.period_id = p.id AND r.status = 'complete'
  ORDER BY r.run_number DESC
  LIMIT 1`;

async function listPayPeriods() {
  const { rows } = await pool.query(`
    SELECT p.id, p.start_date AS "startDate", p.end_date AS "endDate", p.status,
           p.total_gross AS "totalGross", p.total_net AS "totalNet", p.validated_at AS "validatedAt",
           run.id AS "calculationRunId", run.run_number AS "runNumber",
           run.total_gross AS "runTotalGross", run.total_net_payable AS "runTotalNet",
           latest.decision AS "latestDecision", latest.approved_by AS "approvedBy", latest.decided_at AS "decidedAt"
    FROM pay_period p
    LEFT JOIN LATERAL (${authoritativeRunSql}) run ON true
    LEFT JOIN LATERAL (
      SELECT decision, approved_by, decided_at FROM approval
      WHERE pay_period_id = p.id ORDER BY decided_at DESC, created_at DESC LIMIT 1
    ) latest ON true
    ORDER BY p.start_date DESC, p.end_date DESC`);
  return rows;
}

async function getSummary(payPeriodId) {
  const { rows } = await pool.query(`
    WITH selected AS (
      SELECT p.*, run.id AS run_id, run.run_number, run.total_gross AS run_gross,
             run.total_net_payable AS run_net, run.lines_incomplete
      FROM pay_period p LEFT JOIN LATERAL (${authoritativeRunSql}) run ON true
      WHERE p.id = $1
    ), previous AS (
      SELECT r.total_net_payable FROM calculation_runs r JOIN pay_period pp ON pp.id = r.period_id
      WHERE pp.end_date < (SELECT start_date FROM selected) AND pp.status IN ('approved','paid')
        AND r.status = 'complete' ORDER BY pp.end_date DESC, r.run_number DESC LIMIT 1
    )
    SELECT p.id AS "payPeriodId", p.start_date AS "startDate", p.end_date AS "endDate", p.status,
           p.validated_at AS "validatedAt", p.run_id AS "calculationRunId", p.run_number AS "runNumber",
           p.run_gross AS "totalGross", p.run_net AS "totalNet",
           (SELECT total_net_payable FROM previous) AS "previousTotalNet",
           COALESCE(json_agg(json_build_object(
             'id', pl.id, 'fullName', s.full_name, 'grossPay', pl.gross_total - pl.incentive_amount,
             'incentivePay', pl.incentive_amount, 'cpfAmount', pl.cpf_employee,
             'sdlAmount', pl.sdl, 'netPay', pl.net_pay, 'status', pl.line_status
           ) ORDER BY s.full_name) FILTER (WHERE pl.id IS NOT NULL), '[]'::json) AS lines
    FROM selected p LEFT JOIN payroll_lines pl ON pl.run_id = p.run_id LEFT JOIN staff s ON s.id = pl.staff_id
    GROUP BY p.id, p.start_date, p.end_date, p.status, p.validated_at, p.run_id, p.run_number,
             p.run_gross, p.run_net, p.lines_incomplete`, [payPeriodId]);
  return rows[0] || null;
}

async function getLineDetail(lineId) {
  const { rows } = await pool.query(`
    SELECT pl.id, s.full_name AS "fullName", s.employment_type AS "employmentType",
           pl.gross_total - pl.incentive_amount AS "grossPay", pl.incentive_amount AS "incentivePay",
           pl.cpf_employee AS "cpfAmount", pl.sdl AS "sdlAmount", pl.net_pay AS "netPay",
           pl.line_status AS status, pl.regular_hours + pl.ot_hours + pl.ph_hours AS "totalHours",
           pl.ot_hours AS "otHours", pl.ph_hours AS "phHours",
           COALESCE((SELECT json_agg(json_build_object('metricType', pi.input_type,
             'metricValue', pi.quantity, 'unitValue', pi.unit_value)) FROM performance_inputs pi
             WHERE pi.period_id = pl.period_id AND pi.staff_id = pl.staff_id AND pi.deleted_at IS NULL), '[]'::json)
             AS "performanceInputs"
    FROM payroll_lines pl JOIN staff s ON s.id = pl.staff_id WHERE pl.id = $1`, [lineId]);
  return rows[0] || null;
}

async function submitDecision(body, actor) {
  const error = validationError(body);
  if (error) return error;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: periods } = await client.query("SELECT id, status FROM pay_period WHERE id = $1 FOR UPDATE", [body.payPeriodId]);
    const period = periods[0];
    if (!period) { await client.query("ROLLBACK"); return { error: "NOT_FOUND", message: "Pay period not found." }; }
    if (period.status !== "pending_approval") { await client.query("ROLLBACK"); return { error: "INVALID_STATUS", message: "This pay period is not awaiting approval.", status: period.status }; }

    const { rows: runs } = await client.query(`SELECT id, run_number, lines_incomplete, total_gross, total_net_payable
      FROM calculation_runs WHERE id = $1 AND period_id = $2 AND status = 'complete' FOR UPDATE`,
      [body.calculationRunId, body.payPeriodId]);
    const run = runs[0];
    if (!run) { await client.query("ROLLBACK"); return { error: "RUN_NOT_FOUND", message: "The selected calculation run is not valid for this period." }; }
    const { rows: latest } = await client.query(`SELECT id FROM calculation_runs WHERE period_id = $1 AND status = 'complete'
      ORDER BY run_number DESC LIMIT 1`, [body.payPeriodId]);
    if (latest[0]?.id !== run.id) { await client.query("ROLLBACK"); return { error: "STALE_RUN", message: "A newer calculation run must be reviewed." }; }
    if (Number(run.lines_incomplete) > 0) { await client.query("ROLLBACK"); return { error: "INCOMPLETE_LINES", message: "Complete all payroll lines before approval." }; }

    const approved = body.decision === "approved";
    const status = approved ? "approved" : "calculated";
    const approvedBy = actor.fullName || actor.email || actor.id;
    await client.query(`UPDATE pay_period SET status = $2, is_locked = $3,
      locked_at = CASE WHEN $3 THEN now() ELSE NULL END, total_gross = $4, total_net = $5, updated_at = now()
      WHERE id = $1`, [body.payPeriodId, status, approved, run.total_gross, run.total_net_payable]);
    const { rows: decisions } = await client.query(`INSERT INTO approval
      (pay_period_id, calculation_run_id, decision, approved_by, comment)
      VALUES ($1,$2,$3,$4,$5) RETURNING id, pay_period_id AS "payPeriodId",
      calculation_run_id AS "calculationRunId", decision, approved_by AS "approvedBy", comment,
      decided_at AS "decidedAt"`, [body.payPeriodId, run.id, body.decision, approvedBy, String(body.comment || "").trim() || null]);
    await client.query(`INSERT INTO audit_log
      (user_id, user_role, action, entity_type, entity_id, actor, details)
      VALUES ($1,$2,$3,'pay_period',$4,$5,$6)`, [
      actor.id,
      actor.role,
      approved ? "PAYROLL_APPROVED" : "PAYROLL_REJECTED",
      body.payPeriodId,
      actor.email || approvedBy,
      JSON.stringify({ calculationRunId: run.id, comment: String(body.comment || "").trim() || null }),
    ]);
    await client.query("COMMIT");
    return { ...decisions[0], status, isLocked: approved };
  } catch (err) {
    await client.query("ROLLBACK"); throw err;
  } finally { client.release(); }
}

module.exports = { listPayPeriods, getSummary, getLineDetail, submitDecision, validationError };
