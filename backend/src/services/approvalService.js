const { pool } = require("../config/database");

function validationError(body = {}) {
  const { payPeriodId, decision, approvedBy } = body;
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";

  if (!payPeriodId || !["approved", "rejected"].includes(decision) || !approvedBy?.trim()) {
    return {
      error: "VALIDATION_ERROR",
      message: "payPeriodId, an approved or rejected decision, and approvedBy are required.",
    };
  }

  if (decision === "rejected" && !comment) {
    return { error: "COMMENT_REQUIRED", message: "A comment is required when rejecting a payroll period." };
  }

  return null;
}

async function listPayPeriods() {
  const { rows } = await pool.query(`
    SELECT
      p.id,
      p.start_date AS "startDate",
      p.end_date AS "endDate",
      p.status,
      p.total_gross AS "totalGross",
      p.total_net AS "totalNet",
      p.validated_at AS "validatedAt",
      latest.decision AS "latestDecision",
      latest.approved_by AS "approvedBy",
      latest.decided_at AS "decidedAt"
    FROM pay_period p
    LEFT JOIN LATERAL (
      SELECT decision, approved_by, decided_at
      FROM approval
      WHERE pay_period_id = p.id
      ORDER BY decided_at DESC, created_at DESC
      LIMIT 1
    ) latest ON true
    ORDER BY p.start_date DESC, p.end_date DESC
  `);
  return rows;
}

async function getSummary(payPeriodId) {
  const { rows } = await pool.query(`
    WITH selected_period AS (
      SELECT id, start_date, end_date, status, validated_at, total_gross, total_net
      FROM pay_period
      WHERE id = $1
    ), previous_period AS (
      SELECT total_net
      FROM pay_period
      WHERE end_date < (SELECT start_date FROM selected_period)
        AND status = 'approved'
      ORDER BY end_date DESC
      LIMIT 1
    )
    SELECT
      p.id AS "payPeriodId",
      p.start_date AS "startDate",
      p.end_date AS "endDate",
      p.status,
      p.validated_at AS "validatedAt",
      p.total_gross AS "totalGross",
      p.total_net AS "totalNet",
      (SELECT total_net FROM previous_period) AS "previousTotalNet",
      COALESCE(
        json_agg(
          json_build_object(
            'id', pl.id,
            'fullName', s.full_name,
            'grossPay', pl.gross_pay,
            'incentivePay', pl.incentive_pay,
            'cpfAmount', pl.cpf_amount,
            'sdlAmount', pl.sdl_amount,
            'netPay', pl.net_pay,
            'status', pl.status
          ) ORDER BY s.full_name
        ) FILTER (WHERE pl.id IS NOT NULL),
        '[]'::json
      ) AS lines
    FROM selected_period p
    LEFT JOIN payroll_line pl ON pl.pay_period_id = p.id
    LEFT JOIN staff s ON s.id = pl.staff_id
    GROUP BY p.id, p.start_date, p.end_date, p.status, p.validated_at, p.total_gross, p.total_net
  `, [payPeriodId]);
  return rows[0] || null;
}

async function getLineDetail(lineId) {
  const { rows } = await pool.query(`
    SELECT
      pl.id,
      s.full_name AS "fullName",
      s.employment_type AS "employmentType",
      pl.gross_pay AS "grossPay",
      pl.incentive_pay AS "incentivePay",
      pl.cpf_amount AS "cpfAmount",
      pl.sdl_amount AS "sdlAmount",
      pl.net_pay AS "netPay",
      pl.status,
      COALESCE(t.total_hours, 0) AS "totalHours",
      COALESCE(t.ot_hours, 0) AS "otHours",
      COALESCE(t.ph_hours, 0) AS "phHours",
      COALESCE((
        SELECT json_agg(json_build_object('metricType', pi.metric_type, 'metricValue', pi.metric_value))
        FROM performance_input pi
        WHERE pi.pay_period_id = pl.pay_period_id AND pi.staff_id = pl.staff_id
      ), '[]'::json) AS "performanceInputs"
    FROM payroll_line pl
    JOIN staff s ON s.id = pl.staff_id
    LEFT JOIN timesheet t ON t.pay_period_id = pl.pay_period_id AND t.staff_id = pl.staff_id
    WHERE pl.id = $1
  `, [lineId]);
  return rows[0] || null;
}

async function submitDecision(body) {
  const error = validationError(body);
  if (error) return error;

  const approvedBy = body.approvedBy.trim();
  const comment = typeof body.comment === "string" ? body.comment.trim() || null : null;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const periodResult = await client.query(
      "SELECT id, status FROM pay_period WHERE id = $1 FOR UPDATE",
      [body.payPeriodId],
    );
    const period = periodResult.rows[0];

    if (!period) {
      await client.query("ROLLBACK");
      return { error: "NOT_FOUND", message: "Pay period not found." };
    }
    if (period.status !== "pending_approval") {
      await client.query("ROLLBACK");
      return { error: "INVALID_STATUS", message: "This pay period is not awaiting approval.", status: period.status };
    }

    const incompleteLines = await client.query(
      "SELECT 1 FROM payroll_line WHERE pay_period_id = $1 AND status = 'incomplete' LIMIT 1",
      [body.payPeriodId],
    );
    if (incompleteLines.rowCount) {
      await client.query("ROLLBACK");
      return { error: "INCOMPLETE_LINES", message: "Complete all payroll lines before approval." };
    }

    const resultingStatus = body.decision === "approved" ? "approved" : "pending_calculation";
    const updateResult = await client.query(`
      UPDATE pay_period
      SET status = $2, updated_at = now()
      WHERE id = $1
      RETURNING id AS "payPeriodId", status, updated_at AS "updatedAt"
    `, [body.payPeriodId, resultingStatus]);
    const approvalResult = await client.query(`
      INSERT INTO approval (pay_period_id, decision, approved_by, comment)
      VALUES ($1, $2, $3, $4)
      RETURNING id, pay_period_id AS "payPeriodId", decision,
                approved_by AS "approvedBy", comment, decided_at AS "decidedAt", created_at AS "createdAt"
    `, [body.payPeriodId, body.decision, approvedBy, comment]);

    await client.query("COMMIT");
    return { ...approvalResult.rows[0], status: updateResult.rows[0].status };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { listPayPeriods, getSummary, getLineDetail, submitDecision };
