const { pool } = require("../config/database");
const AppError = require("../utils/AppError");
const auditService = require("./auditService");
const { detectDiscrepancies } = require("./validationRulesEngine");

const RULE_LABELS = {
  overlap: "Overlapping shifts",
  exceeds_cap: "Hours exceed threshold",
  missing_entry: "Missing / unmatched entry",
  public_holiday: "Public holiday review",
};

const unresolvedStatuses = ["open", "returned"];

async function ensurePeriod(payPeriodId) {
  const { rows } = await pool.query(
    `SELECT id, start_date, end_date, status, validated_at
     FROM pay_period
     WHERE id = $1`,
    [payPeriodId]
  );
  if (!rows[0]) throw new AppError(404, "PAY_PERIOD_NOT_FOUND", "The selected pay period does not exist.");
  return rows[0];
}

async function listPeriods() {
  const { rows } = await pool.query(
    `SELECT id,
            start_date AS "startDate",
            end_date AS "endDate",
            status,
            validated_at AS "validatedAt"
     FROM pay_period
     ORDER BY start_date DESC`
  );
  return { rows };
}

async function getTimesheetRows(payPeriodId) {
  const { rows } = await pool.query(
    `SELECT t.id,
            t.staff_id AS "staffId",
            s.external_ref AS "externalRef",
            s.full_name AS "fullName",
            t.roster_raw_name AS "rosterRawName",
            to_char(t.shift_date, 'YYYY-MM-DD') AS "shiftDate",
            t.total_hours AS "totalHours",
            t.ot_hours AS "otHours",
            t.ph_hours AS "phHours",
            t.clock_in AS "clockIn",
            t.clock_out AS "clockOut",
            t.match_status AS "matchStatus",
            t.is_frozen AS "isFrozen"
     FROM timesheet t
     LEFT JOIN staff s ON s.id = t.staff_id
     WHERE t.pay_period_id = $1
     ORDER BY t.shift_date, s.external_ref NULLS LAST, t.created_at`,
    [payPeriodId]
  );
  return rows;
}

async function runValidation(payPeriodId, context = {}) {
  await ensurePeriod(payPeriodId);
  const timesheets = await getTimesheetRows(payPeriodId);
  const { rows: staff } = await pool.query(
    `SELECT id,
            external_ref AS "externalRef",
            full_name AS "fullName",
            status
     FROM staff
     WHERE status = 'active'`
  );

  const detected = detectDiscrepancies(timesheets, staff);
  const client = await pool.connect();
  let inserted = 0;

  try {
    await client.query("BEGIN");

    // Re-running validation refreshes unresolved findings but keeps previous
    // corrected/noted decisions as an audit-friendly record.
    await client.query(
      `DELETE FROM timesheet_exception
       WHERE pay_period_id = $1 AND status IN ('open', 'returned')`,
      [payPeriodId]
    );

    for (const flag of detected) {
      const { rows: resolved } = await client.query(
        `SELECT id
         FROM timesheet_exception
         WHERE pay_period_id = $1
           AND rule_type = $2
           AND staff_id IS NOT DISTINCT FROM $3::uuid
           AND timesheet_id IS NOT DISTINCT FROM $4::uuid
           AND status IN ('corrected', 'noted')
         LIMIT 1`,
        [payPeriodId, flag.ruleType, flag.staffId, flag.timesheetId]
      );
      if (resolved.length) continue;

      await client.query(
        `INSERT INTO timesheet_exception
          (pay_period_id, staff_id, timesheet_id, rule_type, status, note, expected_value, actual_value)
         VALUES ($1, $2, $3, $4, 'open', $5, $6, $7)`,
        [
          payPeriodId,
          flag.staffId,
          flag.timesheetId,
          flag.ruleType,
          flag.message,
          flag.expectedValue,
          flag.actualValue,
        ]
      );
      inserted += 1;
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await auditService.record({
    ...context,
    action: "TIMESHEET_VALIDATION_RUN",
    entityType: "pay_period",
    entityId: payPeriodId,
    details: { detected: detected.length, inserted },
  });

  return { success: true, detected: detected.length, newlyFlagged: inserted };
}

async function getReview(payPeriodId) {
  const period = await ensurePeriod(payPeriodId);
  const timesheets = await getTimesheetRows(payPeriodId);
  const { rows: exceptions } = await pool.query(
    `SELECT e.id,
            e.pay_period_id AS "payPeriodId",
            e.staff_id AS "staffId",
            e.timesheet_id AS "timesheetId",
            e.rule_type AS "ruleType",
            e.status,
            e.note,
            e.expected_value AS "expectedValue",
            e.actual_value AS "actualValue",
            e.resolved_by AS "resolvedBy",
            e.created_at AS "createdAt",
            e.updated_at AS "updatedAt",
            s.external_ref AS "externalRef",
            s.full_name AS "fullName"
     FROM timesheet_exception e
     LEFT JOIN staff s ON s.id = e.staff_id
     WHERE e.pay_period_id = $1
     ORDER BY e.created_at DESC`,
    [payPeriodId]
  );

  const groups = new Map();
  const timesheetToGroup = new Map();

  for (const row of timesheets) {
    const key = row.staffId || `unmatched:${row.id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        staffDbId: row.staffId || null,
        staffId: row.externalRef || "Unmatched",
        name: row.fullName || row.rosterRawName || "Unmatched roster row",
        totalHours: 0,
        entries: [],
        flags: [],
        status: "Matched",
      });
    }
    const group = groups.get(key);
    group.totalHours += Number(row.totalHours || 0);
    group.entries.push({
      id: row.id,
      date: row.shiftDate,
      clockIn: row.clockIn,
      clockOut: row.clockOut,
      actualHours: Number(row.totalHours || 0),
      matchStatus: row.matchStatus,
      isFrozen: row.isFrozen,
    });
    timesheetToGroup.set(row.id, key);
  }

  for (const exception of exceptions) {
    const key = exception.staffId || timesheetToGroup.get(exception.timesheetId) || `exception:${exception.id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        staffDbId: exception.staffId || null,
        staffId: exception.externalRef || "Unmatched",
        name: exception.fullName || "Missing / unmatched staff",
        totalHours: 0,
        entries: [],
        flags: [],
        status: "Flagged",
      });
    }
    const group = groups.get(key);
    group.flags.push({
      id: exception.id,
      entryId: exception.timesheetId,
      flagType: exception.ruleType,
      label: RULE_LABELS[exception.ruleType] || exception.ruleType,
      status: exception.status,
      note: exception.note,
      expectedValue: exception.expectedValue,
      actualValue: exception.actualValue,
      resolvedBy: exception.resolvedBy,
      createdAt: exception.createdAt,
    });
  }

  const staff = Array.from(groups.values()).map((group) => {
    const hasBlocking = group.flags.some((flag) => unresolvedStatuses.includes(flag.status));
    return {
      ...group,
      totalHours: Math.round(group.totalHours * 100) / 100,
      status: hasBlocking ? "Flagged" : group.flags.length ? "Resolved" : "Matched",
    };
  });

  const discrepancyCount = exceptions.filter((item) => unresolvedStatuses.includes(item.status)).length;
  const totalHoursValidated = Math.round(
    timesheets
      .filter((row) => row.matchStatus === "matched")
      .reduce((sum, row) => sum + Number(row.totalHours || 0), 0) * 100
  ) / 100;

  return {
    success: true,
    period: {
      id: period.id,
      startDate: period.start_date,
      endDate: period.end_date,
      status: period.status,
      validatedAt: period.validated_at,
    },
    status: period.status,
    lastValidatedAt: period.validated_at,
    staffReviewed: staff.filter((item) => item.staffDbId).length,
    totalHoursValidated,
    discrepancyCount,
    canValidate: timesheets.length > 0 && discrepancyCount === 0,
    staff,
  };
}

async function resolveException(exceptionId, payload, context = {}) {
  const { rows } = await pool.query(
    `SELECT id, pay_period_id, timesheet_id, rule_type
     FROM timesheet_exception
     WHERE id = $1`,
    [exceptionId]
  );
  const exception = rows[0];
  if (!exception) throw new AppError(404, "EXCEPTION_NOT_FOUND", "The validation exception does not exist.");

  const { resolution, correctedHours, note } = payload;
  if (resolution === "corrected" && exception.timesheet_id) {
    if (correctedHours === undefined || correctedHours === null) {
      throw new AppError(400, "CORRECTED_HOURS_REQUIRED", "Corrected hours are required when resolving an entry as corrected.");
    }
    await pool.query(
      `UPDATE timesheet
       SET total_hours = $1, updated_at = now()
       WHERE id = $2`,
      [correctedHours, exception.timesheet_id]
    );
  }

  await pool.query(
    `UPDATE timesheet_exception
     SET status = $1,
         note = COALESCE($2, note),
         resolved_by = $3,
         updated_at = now()
     WHERE id = $4`,
    [resolution, note || null, context.user?.email || "manager", exceptionId]
  );

  await auditService.record({
    ...context,
    action: "TIMESHEET_EXCEPTION_RESOLVED",
    entityType: "pay_period",
    entityId: exception.pay_period_id,
    details: { exceptionId, resolution, correctedHours: correctedHours ?? null },
  });

  return { success: true };
}

async function bulkResolveExceptions(payPeriodId, { ruleType, note }, context = {}) {
  await ensurePeriod(payPeriodId);
  const result = await pool.query(
    `UPDATE timesheet_exception
     SET status = 'noted',
         note = COALESCE($1, note),
         resolved_by = $2,
         updated_at = now()
     WHERE pay_period_id = $3
       AND rule_type = $4
       AND status IN ('open', 'returned')
     RETURNING id`,
    [note || `Bulk-confirmed ${ruleType} exceptions.`, context.user?.email || "manager", payPeriodId, ruleType]
  );

  await auditService.record({
    ...context,
    action: "TIMESHEET_EXCEPTIONS_BULK_RESOLVED",
    entityType: "pay_period",
    entityId: payPeriodId,
    details: { ruleType, resolvedCount: result.rowCount },
  });

  return { success: true, resolvedCount: result.rowCount };
}

async function markValidated(payPeriodId, context = {}) {
  const period = await ensurePeriod(payPeriodId);
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM timesheet_exception
     WHERE pay_period_id = $1 AND status IN ('open', 'returned')`,
    [payPeriodId]
  );
  const unresolvedCount = Number(rows[0].count || 0);
  if (unresolvedCount > 0) {
    throw new AppError(
      409,
      "UNRESOLVED_TIMESHEET_EXCEPTIONS",
      "Resolve or note every blocking timesheet exception before validating this pay period.",
      [{ unresolvedCount }]
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const frozen = await client.query(
      `UPDATE timesheet
       SET is_frozen = true, updated_at = now()
       WHERE pay_period_id = $1
       RETURNING id`,
      [payPeriodId]
    );
    await client.query(
      `UPDATE pay_period
       SET status = 'validated', validated_at = now(), updated_at = now()
       WHERE id = $1`,
      [payPeriodId]
    );
    await client.query("COMMIT");

    await auditService.record({
      ...context,
      action: "TIMESHEET_PERIOD_VALIDATED",
      entityType: "pay_period",
      entityId: payPeriodId,
      details: { frozenTimesheetRows: frozen.rowCount, previousStatus: period.status },
    });

    return { success: true, frozenTimesheetRows: frozen.rowCount };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getAuditLog(payPeriodId) {
  await ensurePeriod(payPeriodId);
  return { entries: await auditService.getHistory("pay_period", payPeriodId, 30) };
}

async function getValidatedTimesheetForPeriod(payPeriodId) {
  const period = await ensurePeriod(payPeriodId);
  if (period.status !== "validated") {
    throw new AppError(409, "PERIOD_NOT_VALIDATED", "This pay period has not been validated yet.");
  }

  const { rows } = await pool.query(
    `SELECT s.id AS "staffDbId",
            s.external_ref AS "externalRef",
            s.full_name AS "fullName",
            ROUND(SUM(t.total_hours)::numeric, 2) AS "totalHours"
     FROM timesheet t
     JOIN staff s ON s.id = t.staff_id
     WHERE t.pay_period_id = $1
       AND t.is_frozen = true
       AND t.match_status = 'matched'
     GROUP BY s.id, s.external_ref, s.full_name
     ORDER BY s.external_ref`,
    [payPeriodId]
  );

  return { success: true, payPeriodId, staff: rows };
}

module.exports = {
  listPeriods,
  runValidation,
  getReview,
  resolveException,
  bulkResolveExceptions,
  markValidated,
  getAuditLog,
  getValidatedTimesheetForPeriod,
};
