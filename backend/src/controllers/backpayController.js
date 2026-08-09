const { pool } = require("../config/database");
const AppError = require("../utils/AppError");

const REPORT_STATUSES = new Set(["pending", "resolved"]);

exports.create = async (req, res, next) => {
  try {
    const { staff_id: staffId, pay_period_id: payPeriodId, missing_regular_hours: missingRegularHours, missing_ot_hours: missingOtHours } = req.body;
    const description = typeof req.body.description === "string" ? req.body.description.trim() : "";

    if (!staffId || !payPeriodId) {
      throw new AppError(400, "VALIDATION_ERROR", "staff_id and pay_period_id are required.");
    }

    const staffResult = await pool.query(
      `SELECT employment_type, to_char(date_joined, 'YYYY-MM-DD') AS date_joined
       FROM staff
       WHERE id = $1`,
      [staffId]
    );
    const staff = staffResult.rows[0];
    if (!staff) {
      throw new AppError(404, "STAFF_NOT_FOUND", "Staff member not found.");
    }

    const payPeriodResult = await pool.query(
      `SELECT to_char(start_date, 'YYYY-MM-DD') AS start_date
       FROM pay_period
       WHERE id = $1`,
      [payPeriodId]
    );
    const payPeriod = payPeriodResult.rows[0];
    if (!payPeriod) {
      throw new AppError(404, "PAY_PERIOD_NOT_FOUND", "Pay period not found.");
    }
    if (staff.date_joined && payPeriod.start_date < staff.date_joined) {
      throw new AppError(400, "VALIDATION_ERROR", "Pay period cannot be before the staff member's date_joined.");
    }

    const isPartTime = staff.employment_type === "part_time";
    if (isPartTime && (missingRegularHours === undefined || missingRegularHours === null || missingRegularHours === "")) {
      throw new AppError(400, "VALIDATION_ERROR", "missing_regular_hours is required for part-time staff.");
    }
    if (isPartTime && description) {
      throw new AppError(400, "VALIDATION_ERROR", "description is only used for full-time staff reports.");
    }
    if (!isPartTime && (missingRegularHours !== undefined || missingOtHours !== undefined)) {
      throw new AppError(400, "VALIDATION_ERROR", "missing_regular_hours and missing_ot_hours are only used for part-time staff reports.");
    }
    if (!isPartTime && !description) {
      throw new AppError(400, "VALIDATION_ERROR", "description is required for full-time staff.");
    }

    const reportType = isPartTime ? "missing_hours" : "missing_performance_input";
    const missingHours = isPartTime ? Number(missingRegularHours) + Number(missingOtHours || 0) : null;
    const result = await pool.query(
      `INSERT INTO backpay_report (staff_id, pay_period_id, report_type, missing_hours, missing_regular_hours, missing_ot_hours, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, staff_id AS "staffId", pay_period_id AS "payPeriodId", report_type AS "reportType",
                 missing_hours AS "missingHours", missing_regular_hours AS "missingRegularHours",
                 missing_ot_hours AS "missingOtHours", description, status, created_at AS "createdAt",
                 updated_at AS "updatedAt", resolved_at AS "resolvedAt"`,
      [staffId, payPeriodId, reportType, missingHours, isPartTime ? missingRegularHours : null, isPartTime ? missingOtHours ?? null : null, isPartTime ? null : description]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

exports.list = async (req, res, next) => {
  try {
    const { status, staffId } = req.query;
    if (status && !REPORT_STATUSES.has(status)) {
      throw new AppError(400, "VALIDATION_ERROR", "Status filter must be pending or resolved.");
    }

    const filters = [];
    const values = [];
    if (status) {
      values.push(status);
      filters.push(`br.status = $${values.length}`);
    }
    if (staffId) {
      values.push(staffId);
      filters.push(`br.staff_id = $${values.length}`);
    }

    const result = await pool.query(
      `SELECT br.id, br.staff_id AS "staffId", s.full_name AS "staffName",
              br.pay_period_id AS "payPeriodId", to_char(p.start_date, 'YYYY-MM-DD') AS "payPeriodStartDate",
              to_char(p.end_date, 'YYYY-MM-DD') AS "payPeriodEndDate", br.report_type AS "reportType",
              br.missing_hours AS "missingHours", br.missing_regular_hours AS "missingRegularHours",
              br.missing_ot_hours AS "missingOtHours", br.description, br.status,
              br.created_at AS "createdAt", br.updated_at AS "updatedAt", br.resolved_at AS "resolvedAt"
       FROM backpay_report br
       JOIN staff s ON s.id = br.staff_id
       JOIN pay_period p ON p.id = br.pay_period_id${filters.length ? ` WHERE ${filters.join(" AND ")}` : ""}
       ORDER BY br.created_at DESC`,
      values
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

exports.resolve = async (req, res, next) => {
  try {
    const existing = await pool.query("SELECT status FROM backpay_report WHERE id = $1", [req.params.id]);
    const report = existing.rows[0];
    if (!report) {
      throw new AppError(404, "BACKPAY_REPORT_NOT_FOUND", "Backpay report not found.");
    }
    if (report.status === "resolved") {
      throw new AppError(400, "VALIDATION_ERROR", "Backpay report is already resolved.");
    }

    const result = await pool.query(
      `UPDATE backpay_report
       SET status = 'resolved', resolved_at = now(), updated_at = now()
       WHERE id = $1
       RETURNING id, staff_id AS "staffId", pay_period_id AS "payPeriodId", report_type AS "reportType",
                 missing_hours AS "missingHours", missing_regular_hours AS "missingRegularHours",
                 missing_ot_hours AS "missingOtHours", description, status, created_at AS "createdAt",
                 updated_at AS "updatedAt", resolved_at AS "resolvedAt"`,
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};
