// UC-001: The core roster-sync logic.
// Matches roster rows to staff and saves each one as its own shift-level
// timesheet row (not summed), so UC-002 can later check per-date rules
// like overlapping shifts. Unmatched/invalid rows are flagged and excluded
// from totals instead of corrupting them.

const { pool } = require("../config/database");
const { fetchRosterRows } = require("../adapters/googleSheetsAdapter");
const payPeriodService = require("./payPeriodService");
const auditService = require("./auditService");
const { calculateHours } = require("../utils/hoursCalculator");

// Match a roster row to an active staff record. Staff ID is checked first
// because it's the reliable identifier; name is only a fallback for when
// the ID is missing or wrong, since names can have typos or duplicates.
// If a record exists but is inactive, that's reported separately from a
// truly unknown staff member, since the fix for each is different.
async function findMatchingStaff(rosterRow) {
  const byId = await pool.query(
    `SELECT id, external_ref AS "staffId", full_name AS "fullName", status FROM staff WHERE external_ref = $1`,
    [rosterRow["Staff ID"]]
  );
  const idMatch = byId.rows[0];
  if (idMatch && idMatch.status === "active") return { ...idMatch, matchMethod: "id" };

  const byName = await pool.query(
    `SELECT id, external_ref AS "staffId", full_name AS "fullName", status FROM staff WHERE lower(full_name) = lower($1)`,
    [rosterRow["Staff Name"]]
  );
  const nameMatch = byName.rows[0];
  if (nameMatch && nameMatch.status === "active") return { ...nameMatch, matchMethod: "name" };

  const inactiveMatch = (idMatch && idMatch.status === "inactive") || (nameMatch && nameMatch.status === "inactive");
  if (inactiveMatch) return { inactive: true, fullName: (idMatch || nameMatch).fullName };

  return null;
}

// Runs a full roster sync: read rows -> match -> total hours -> save draft.
// payPeriodId defaults to whichever period covers today, so "Import Now"
// and the automatic scheduler both work without the caller picking one.
async function runRosterSync(payPeriodId, actor = "manual") {
  if (!payPeriodId) {
    const activePeriod = await payPeriodService.getActivePayPeriod();
    if (!activePeriod) {
      return {
        success: false,
        error: "ACTIVE_PAY_PERIOD_NOT_FOUND",
        message: "No active pay period is available",
      };
    }
    payPeriodId = activePeriod.id;
  }

  // The use case says the sync reads roster rows "for the active pay
  // period" — we need the period's date range to actually enforce that,
  // otherwise syncing any period would pull every row in the sheet
  // regardless of date.
  const payPeriod = await payPeriodService.getPayPeriod(payPeriodId);
  if (!payPeriod) {
    return {
      success: false,
      error: "PAY_PERIOD_NOT_FOUND",
      message: "The selected pay period does not exist",
    };
  }

  const previousDraft = await getLastSyncResult(payPeriodId);
  let rosterRows;

  try {
    rosterRows = await fetchRosterRows();
  } catch (err) {
    console.error("[rosterSyncService] Could not read the roster sheet:", err.message);
    await auditService.logAction({
      entityType: "pay_period",
      entityId: payPeriodId,
      action: "roster_sync_failed",
      actor,
      detail: { reason: "unreachable" },
    });
    return {
      success: false,
      error: "ROSTER_SOURCE_UNREACHABLE",
      message: "Google Sheet could not be read; previous draft retained",
      previousDraft,
    };
  }

  if (!rosterRows || rosterRows.length === 0) {
    console.error("[rosterSyncService] The roster sheet had no rows.");
    await auditService.logAction({
      entityType: "pay_period",
      entityId: payPeriodId,
      action: "roster_sync_failed",
      actor,
      detail: { reason: "empty" },
    });
    return {
      success: false,
      error: "ROSTER_SOURCE_EMPTY",
      message: "Google Sheet was empty; previous draft retained",
      previousDraft,
    };
  }

  const matchedShifts = [];
  const unmatchedRows = [];
  const invalidTimeRows = [];
  const outOfPeriodRows = [];

  for (const row of rosterRows) {
    // Skip rows outside the target period's date range so syncing one
    // period never pulls in another period's shifts. Dates are plain
    // YYYY-MM-DD strings, so a direct string comparison sorts correctly.
    if (row["Date"] < payPeriod.startDate || row["Date"] > payPeriod.endDate) {
      outOfPeriodRows.push({ rosterRawName: row["Staff Name"], date: row["Date"] });
      continue;
    }

    const matchResult = await findMatchingStaff(row);
    const hoursForRow = calculateHours(row["Clock In"], row["Clock Out"]);

    if (Number.isNaN(hoursForRow)) {
      const label = matchResult && !matchResult.inactive ? matchResult.fullName : row["Staff Name"];
      invalidTimeRows.push({
        staffDbId: matchResult && !matchResult.inactive ? matchResult.id : null,
        rosterRawName: `${label} (missing clock-in/out)`,
        date: row["Date"],
      });
      continue;
    }

    if (!matchResult) {
      unmatchedRows.push({ rosterRawName: row["Staff Name"], date: row["Date"], hours: hoursForRow });
      continue;
    }

    if (matchResult.inactive) {
      unmatchedRows.push({ rosterRawName: `${matchResult.fullName} (inactive staff)`, date: row["Date"], hours: hoursForRow });
      continue;
    }

    matchedShifts.push({
      staffDbId: matchResult.id,
      date: row["Date"],
      hours: hoursForRow,
      matchMethod: matchResult.matchMethod,
      clockIn: row["Clock In"],
      clockOut: row["Clock Out"],
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Replace the draft for this period. Rows already frozen by UC-002
    // validation are left alone, so a re-sync can never overwrite a
    // validated snapshot.
    await client.query("DELETE FROM timesheet WHERE pay_period_id = $1 AND is_frozen = false", [payPeriodId]);

    for (const shift of matchedShifts) {
      await client.query(
        `INSERT INTO timesheet (pay_period_id, staff_id, shift_date, total_hours, match_status, match_method, clock_in, clock_out)
         VALUES ($1, $2, $3, $4, 'matched', $5, $6, $7)`,
        [payPeriodId, shift.staffDbId, shift.date, shift.hours, shift.matchMethod, shift.clockIn, shift.clockOut]
      );
    }

    for (const entry of unmatchedRows) {
      await client.query(
        `INSERT INTO timesheet (pay_period_id, staff_id, roster_raw_name, shift_date, total_hours, match_status)
         VALUES ($1, NULL, $2, $3, $4, 'unmatched')`,
        [payPeriodId, entry.rosterRawName, entry.date, entry.hours]
      );
    }

    for (const entry of invalidTimeRows) {
      await client.query(
        `INSERT INTO timesheet (pay_period_id, staff_id, roster_raw_name, shift_date, total_hours, match_status)
         VALUES ($1, $2, $3, $4, 0, 'invalid_time')`,
        [payPeriodId, entry.staffDbId, entry.rosterRawName, entry.date]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const result = await getLastSyncResult(payPeriodId);
  await auditService.logAction({
    entityType: "pay_period",
    entityId: payPeriodId,
    action: "roster_synced",
    actor,
    detail: {
      staffSynced: result.staffSynced,
      totalHours: result.totalHours,
      unmatchedCount: result.unmatchedCount,
      invalidTimeCount: result.invalidTimeCount,
      outOfPeriodCount: outOfPeriodRows.length,
    },
  });
  return result;
}

// Returns whatever the last sync produced for a pay period, without
// running a new sync. Used when the page first loads, so it shows the
// latest draft immediately.
async function getLastSyncResult(payPeriodId) {
  if (!payPeriodId) {
    const activePeriod = await payPeriodService.getActivePayPeriod();
    payPeriodId = activePeriod.id;
  }

  const { rows } = await pool.query(
    `SELECT t.id, s.external_ref AS staff_ext_ref, s.full_name,
            t.roster_raw_name, to_char(t.shift_date, 'YYYY-MM-DD') AS shift_date,
            t.total_hours, t.match_status, t.match_method, t.clock_in, t.clock_out, t.updated_at
     FROM timesheet t
     LEFT JOIN staff s ON s.id = t.staff_id
     WHERE t.pay_period_id = $1
     ORDER BY t.shift_date`,
    [payPeriodId]
  );

  if (rows.length === 0) {
    return {
      success: false,
      payPeriodId,
      message: 'No sync has been run yet for this pay period. Click "Import Now" to run the first sync.',
    };
  }

  const totalsByStaff = new Map();
  rows
    .filter((row) => row.match_status === "matched")
    .forEach((row) => {
      const existing = totalsByStaff.get(row.staff_ext_ref) || {
        staffId: row.staff_ext_ref,
        fullName: row.full_name,
        totalHours: 0,
        shifts: [],
      };
      existing.totalHours += Number(row.total_hours);
      existing.shifts.push({
        date: row.shift_date,
        hours: Number(row.total_hours),
        matchedBy: row.match_method,
        clockIn: row.clock_in,
        clockOut: row.clock_out,
      });
      totalsByStaff.set(row.staff_ext_ref, existing);
    });

  const draftTimesheets = Array.from(totalsByStaff.values()).map((staffTotal) => ({
    ...staffTotal,
    totalHours: Math.round(staffTotal.totalHours * 100) / 100,
    matchStatus: "matched",
  }));

  const unmatched = rows
    .filter((row) => row.match_status === "unmatched")
    .map((row) => ({
      id: row.id,
      rosterRawName: row.roster_raw_name,
      date: row.shift_date,
      hours: Number(row.total_hours),
    }));

  const invalidTime = rows
    .filter((row) => row.match_status === "invalid_time")
    .map((row) => ({
      id: row.id,
      rosterRawName: row.roster_raw_name || row.full_name,
      date: row.shift_date,
    }));

  const totalHours = Math.round(draftTimesheets.reduce((sum, t) => sum + t.totalHours, 0) * 100) / 100;
  const syncedAt = rows.reduce((latest, row) => (row.updated_at > latest ? row.updated_at : latest), rows[0].updated_at);

  return {
    success: true,
    payPeriodId,
    staffSynced: draftTimesheets.length,
    totalHours,
    unmatchedCount: unmatched.length,
    invalidTimeCount: invalidTime.length,
    syncedAt: syncedAt.toISOString(),
    draftTimesheets,
    unmatched,
    invalidTime,
  };
}

async function resolveException(timesheetRowId, resolution) {
  const rowResult = await pool.query(
    `SELECT id, staff_id, match_status, is_frozen
     FROM timesheet
     WHERE id = $1`,
    [timesheetRowId]
  );
  const row = rowResult.rows[0];

  if (!row) {
    return {
      success: false,
      error: "TIMESHEET_ROW_NOT_FOUND",
      message: "The timesheet row does not exist",
    };
  }
  if (row.is_frozen) {
    return {
      success: false,
      error: "TIMESHEET_ROW_FROZEN",
      message: "Frozen timesheet rows cannot be resolved",
    };
  }

  if (resolution?.ignore === true) {
    await pool.query(
      `UPDATE timesheet
       SET match_status = 'ignored', updated_at = now()
       WHERE id = $1`,
      [timesheetRowId]
    );
    return { success: true, timesheetRowId, resolution: "ignored" };
  }

  if (resolution?.staffId) {
    const staffResult = await pool.query(
      "SELECT id FROM staff WHERE id = $1 AND status = 'active'",
      [resolution.staffId]
    );
    if (!staffResult.rows[0]) {
      return {
        success: false,
        error: "STAFF_NOT_FOUND_OR_INACTIVE",
        message: "The selected staff member does not exist or is inactive",
      };
    }

    await pool.query(
      `UPDATE timesheet
       SET staff_id = $1, roster_raw_name = NULL, match_status = 'matched', match_method = 'manual', updated_at = now()
       WHERE id = $2`,
      [resolution.staffId, timesheetRowId]
    );
    return { success: true, timesheetRowId, resolution: "staff_linked" };
  }

  if (row.match_status === "invalid_time" && resolution?.clockIn !== undefined && resolution?.clockOut !== undefined) {
    const hours = calculateHours(resolution.clockIn, resolution.clockOut);
    if (Number.isNaN(hours)) {
      return {
        success: false,
        error: "INVALID_CLOCK_TIMES",
        message: "Clock-in and clock-out must be valid 24-hour times",
      };
    }

    await pool.query(
      `UPDATE timesheet
       SET clock_in = $1, clock_out = $2, total_hours = $3, match_status = 'matched', updated_at = now()
       WHERE id = $4`,
      [resolution.clockIn, resolution.clockOut, hours, timesheetRowId]
    );
    return { success: true, timesheetRowId, resolution: "clock_times_updated" };
  }

  return {
    success: false,
    error: "INVALID_EXCEPTION_RESOLUTION",
    message: "Provide an active staffId, ignore: true, or clockIn and clockOut for an invalid-time row",
  };
}

// Recent sync events for this pay period (both scheduled and manual), for
// the "Sync History" panel on the frontend.
async function getSyncHistory(payPeriodId, limit = 10) {
  return auditService.getHistory("pay_period", payPeriodId, limit);
}

module.exports = { runRosterSync, getLastSyncResult, getSyncHistory, resolveException };
