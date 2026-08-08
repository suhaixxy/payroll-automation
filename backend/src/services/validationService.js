// validationService.js
// this is the file that actually talks to the database for UC-002.
// discrepancyRules.js just figures out WHAT is wrong, this file handles
// actually reading/writing to postgres and doing something about it

const { pool } = require('../config/database');
const { detectDiscrepancies } = require('../utils/discrepancyRules');

// just human readable versions of the flag types, for showing on the frontend
const FLAG_LABELS = {
  OVERTIME_DAILY: 'Overtime (daily)',
  OVERTIME_WEEKLY: 'Overtime (weekly)',
  DUPLICATE_ENTRY: 'Duplicate entry',
  MISSING_ENTRY: 'Missing entry',
};

// runs the check for a pay period and saves any new flags it finds
// (steps 1-3 of UC-002 basically)
async function runValidation(payPeriodId) {
  const period = await pool.query('SELECT * FROM pay_period WHERE id = $1', [payPeriodId]);
  if (period.rows.length === 0) {
    return { success: false, error: 'PAY_PERIOD_NOT_FOUND' };
  }

  // grab all the timesheet rows for this period
  const timesheetRes = await pool.query(
    `SELECT id, staff_id AS "staffId", work_date AS "workDate", hours
     FROM timesheet
     WHERE pay_period_id = $1`,
    [payPeriodId]
  );

  // and all the staff so we can check for missing entries too
  const staffRes = await pool.query(
    `SELECT id, external_ref AS "externalRef", full_name AS "fullName", status
     FROM staff`
  );

  const newFlags = detectDiscrepancies(timesheetRes.rows, staffRes.rows);

  // only insert flags that arent already open - dont wanna spam duplicate flags
  // every time someone clicks "run validation" again
  let inserted = 0;
  for (const flag of newFlags) {
    const existing = await pool.query(
      `SELECT id FROM validation_flag
       WHERE pay_period_id = $1 AND staff_id = $2 AND flag_type = $3 AND status = 'OPEN'
         AND (timesheet_id = $4 OR ($4 IS NULL AND timesheet_id IS NULL))`,
      [payPeriodId, flag.staffId, flag.flagType, flag.timesheetId]
    );
    if (existing.rows.length > 0) continue; // already flagged, skip it

    await pool.query(
      `INSERT INTO validation_flag (pay_period_id, timesheet_id, staff_id, flag_type, expected_value, actual_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [payPeriodId, flag.timesheetId, flag.staffId, flag.flagType, flag.expectedValue, flag.actualValue]
    );
    inserted += 1;
  }

  // flip the period status so we know its being looked at
  await pool.query(
    `UPDATE pay_period SET validation_status = 'IN_REVIEW' WHERE id = $1 AND validation_status = 'PENDING'`,
    [payPeriodId]
  );

  // log it for the audit trail
  await pool.query(
    `INSERT INTO audit_log (entity_id, action, details)
     VALUES ($1, 'VALIDATION_RUN', $2)`,
    [payPeriodId, `${inserted} new discrepancy flag(s) raised`]
  );

  return { success: true, newlyFlagged: inserted };
}

// this is the read only one - just builds up the data the frontend page needs
// to show (grouped by staff member). doesnt run the checks again, just reads
// whats already there
async function getReview(payPeriodId) {
  const period = await pool.query('SELECT * FROM pay_period WHERE id = $1', [payPeriodId]);
  if (period.rows.length === 0) {
    return { success: false, error: 'PAY_PERIOD_NOT_FOUND' };
  }

  const timesheetRes = await pool.query(
    `SELECT t.id, t.staff_id AS "staffId", t.work_date AS "workDate", t.hours, t.status,
            s.external_ref AS "externalRef", s.full_name AS "fullName"
     FROM timesheet t
     JOIN staff s ON s.id = t.staff_id
     WHERE t.pay_period_id = $1
     ORDER BY s.external_ref, t.work_date`,
    [payPeriodId]
  );

  const flagsRes = await pool.query(
    `SELECT * FROM validation_flag WHERE pay_period_id = $1`,
    [payPeriodId]
  );

  // group everything by staff id so the frontend can just loop through people
  const staffMap = new Map();
  for (const row of timesheetRes.rows) {
    if (!staffMap.has(row.staffId)) {
      staffMap.set(row.staffId, {
        staffId: row.externalRef,
        name: row.fullName,
        totalHours: 0,
        entries: [],
        flags: [],
        status: 'Matched', // default, gets overwritten below if there's a flag
      });
    }
    const entry = staffMap.get(row.staffId);
    entry.totalHours += Number(row.hours);
    entry.entries.push({ id: row.id, date: row.workDate, actualHours: row.hours });
  }

  // now stick the flags onto the right staff member
  for (const flag of flagsRes.rows) {
    const entry = staffMap.get(flag.staff_id);
    if (!entry) continue;
    entry.flags.push({
      id: flag.id,
      entryId: flag.timesheet_id,
      label: FLAG_LABELS[flag.flag_type] || flag.flag_type,
      status: flag.status,
    });
    // just changes the little status badge shown on the page
    if (flag.status === 'OPEN') entry.status = 'Flagged';
    if (flag.status === 'ESCALATED') entry.status = 'Escalated';
  }

  const staffList = Array.from(staffMap.values());
  const discrepancyCount = flagsRes.rows.filter((f) => f.status === 'OPEN' || f.status === 'ESCALATED').length;
  const totalHoursValidated = staffList.reduce((sum, s) => sum + s.totalHours, 0);

  return {
    success: true,
    status: period.rows[0].validation_status,
    lastValidatedAt: period.rows[0].validated_at,
    staffReviewed: staffList.length,
    totalHoursValidated,
    discrepancyCount,
    staff: staffList,
  };
}

// step 4/5 - supervisor either confirms the hours are right, or corrects them
async function resolveFlag(flagId, { resolution, correctedHours, notes, resolvedBy }) {
  const flagRes = await pool.query('SELECT * FROM validation_flag WHERE id = $1', [flagId]);
  if (flagRes.rows.length === 0) {
    return { success: false, error: 'FLAG_NOT_FOUND' };
  }
  const flag = flagRes.rows[0];

  // if they corrected the hours, actually update the real timesheet row
  if (resolution === 'CORRECTED' && flag.timesheet_id && correctedHours != null) {
    await pool.query('UPDATE timesheet SET hours = $1 WHERE id = $2', [correctedHours, flag.timesheet_id]);
  }

  await pool.query(
    `UPDATE validation_flag
     SET status = 'RESOLVED', resolution_notes = $1, resolved_at = now()
     WHERE id = $2`,
    [notes || null, flagId]
  );

  await pool.query(
    `INSERT INTO audit_log (entity_id, action, details)
     VALUES ($1, 'FLAG_RESOLVED', $2)`,
    [flag.pay_period_id, `Flag ${flagId} resolved (${resolution})${resolvedBy ? ' by staff #' + resolvedBy : ''}`]
  );

  return { success: true };
}

// new: bulk resolve - confirms every OPEN flag of one type in a period at
// once. good for stuff like "everyone worked overtime because of the CNY
// event, just confirm them all" instead of clicking review 15 times.
// only does CONFIRMED resolutions (cant bulk-set different corrected hours
// per person in one go, that still needs resolveFlag() individually)
async function bulkResolveFlags(payPeriodId, flagType, { notes, resolvedBy }) {
  const openFlags = await pool.query(
    `SELECT id FROM validation_flag
     WHERE pay_period_id = $1 AND flag_type = $2 AND status = 'OPEN'`,
    [payPeriodId, flagType]
  );

  if (openFlags.rows.length === 0) {
    return { success: true, resolvedCount: 0 }; // nothing to do, not an error
  }

  await pool.query(
    `UPDATE validation_flag
     SET status = 'RESOLVED', resolution_notes = $1, resolved_at = now()
     WHERE pay_period_id = $2 AND flag_type = $3 AND status = 'OPEN'`,
    [notes || `Bulk-confirmed as part of ${flagType} batch`, payPeriodId, flagType]
  );

  await pool.query(
    `INSERT INTO audit_log (entity_id, action, details)
     VALUES ($1, 'FLAGS_BULK_RESOLVED', $2)`,
    [payPeriodId, `${openFlags.rows.length} ${flagType} flag(s) bulk-confirmed${resolvedBy ? ' by staff #' + resolvedBy : ''}`]
  );

  return { success: true, resolvedCount: openFlags.rows.length };
}

// new: gets the audit trail for a period so the frontend can actually show
// it instead of the info just sitting unused in the database
async function getAuditLog(payPeriodId) {
  const result = await pool.query(
    `SELECT id, action, details, created_at
     FROM audit_log
     WHERE entity_id = $1
     ORDER BY created_at DESC`,
    [payPeriodId]
  );
  return { success: true, entries: result.rows };
}

// alt flow - if the supervisor cant be reached, this bumps it up to the
// managing director instead
async function escalateFlag(flagId, { notes, escalatedBy }) {
  const flagRes = await pool.query('SELECT * FROM validation_flag WHERE id = $1', [flagId]);
  if (flagRes.rows.length === 0) {
    return { success: false, error: 'FLAG_NOT_FOUND' };
  }
  const flag = flagRes.rows[0];

  await pool.query(`UPDATE validation_flag SET status = 'ESCALATED' WHERE id = $1`, [flagId]);

  await pool.query(
    `INSERT INTO audit_log (entity_id, action, details)
     VALUES ($1, 'FLAG_ESCALATED', $2)`,
    [flag.pay_period_id, notes || `Flag ${flagId} escalated to Managing Director`]
  );

  return { success: true };
}

// step 6 - the final "im done checking this period" button basically
// wont let you validate if there's still open/escalated flags hanging around,
// thats the main business rule for this whole use case
//
// ALSO: once validated, this takes a "snapshot" - a frozen copy of each
// staff member's total hours - so UC-003 (payroll calc) always uses this
// frozen copy instead of the live timesheet table. that way if someone
// edits a timesheet row after validation by mistake, payroll doesnt
// silently use the wrong number
async function markValidated(payPeriodId) {
  const blocking = await pool.query(
    `SELECT COUNT(*) FROM validation_flag WHERE pay_period_id = $1 AND status IN ('OPEN', 'ESCALATED')`,
    [payPeriodId]
  );
  if (Number(blocking.rows[0].count) > 0) {
    // nope, still stuff to sort out first
    return { success: false, error: 'UNRESOLVED_DISCREPANCIES', unresolvedCount: Number(blocking.rows[0].count) };
  }

  await pool.query(
    `UPDATE pay_period SET validation_status = 'VALIDATED', validated_at = now() WHERE id = $1`,
    [payPeriodId]
  );
  await pool.query(`UPDATE timesheet SET status = 'VALIDATED' WHERE pay_period_id = $1`, [payPeriodId]);

  // take the snapshot - add up each staff member's hours and freeze it
  const totals = await pool.query(
    `SELECT staff_id, SUM(hours) AS total_hours
     FROM timesheet
     WHERE pay_period_id = $1
     GROUP BY staff_id`,
    [payPeriodId]
  );

  for (const row of totals.rows) {
    await pool.query(
      `INSERT INTO payroll_snapshot (pay_period_id, staff_id, total_hours)
       VALUES ($1, $2, $3)
       ON CONFLICT (pay_period_id, staff_id)
       DO UPDATE SET total_hours = $3, snapshot_at = now()`,
      [payPeriodId, row.staff_id, row.total_hours]
    );
  }

  await pool.query(
    `INSERT INTO audit_log (entity_id, action, details)
     VALUES ($1, 'PERIOD_VALIDATED', 'Timesheet validated and ready for payroll calculation')`,
    [payPeriodId]
  );

  return { success: true, snapshotCount: totals.rows.length };
}

// this is the function UC-003 should call to get payroll data.
// it ONLY works if the period is actually validated, and it reads from the
// frozen snapshot - never the live timesheet table. this stops UC-003 from
// accidentally using unvalidated or since-edited numbers
async function getValidatedTimesheetForPeriod(payPeriodId) {
  const period = await pool.query('SELECT * FROM pay_period WHERE id = $1', [payPeriodId]);
  if (period.rows.length === 0) {
    return { success: false, error: 'PAY_PERIOD_NOT_FOUND' };
  }
  if (period.rows[0].validation_status !== 'VALIDATED') {
    // this is the "fail loudly" part - dont let payroll run on unfinished data
    return { success: false, error: 'PERIOD_NOT_VALIDATED', currentStatus: period.rows[0].validation_status };
  }

  const snapshot = await pool.query(
    `SELECT ps.staff_id AS "staffId", ps.total_hours AS "totalHours",
            s.external_ref AS "externalRef", s.full_name AS "fullName"
     FROM payroll_snapshot ps
     JOIN staff s ON s.id = ps.staff_id
     WHERE ps.pay_period_id = $1
     ORDER BY s.external_ref`,
    [payPeriodId]
  );

  return { success: true, staff: snapshot.rows };
}

module.exports = { runValidation, getReview, resolveFlag, escalateFlag, markValidated, bulkResolveFlags, getAuditLog, getValidatedTimesheetForPeriod };
