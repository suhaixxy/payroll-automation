const DAILY_LIMIT_HOURS = 8;
const WEEKLY_LIMIT_HOURS = 44;

const toNumber = (value) => Number(value || 0);

function isoWeekKey(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  const target = new Date(date.valueOf());
  const dayNumber = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / (7 * 24 * 60 * 60 * 1000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function timeToMinutes(value) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function shiftsOverlap(first, second) {
  const firstStart = timeToMinutes(first.clockIn);
  const firstEnd = timeToMinutes(first.clockOut);
  const secondStart = timeToMinutes(second.clockIn);
  const secondEnd = timeToMinutes(second.clockOut);

  if ([firstStart, firstEnd, secondStart, secondEnd].some((value) => value === null)) return false;
  // UC-001 stores a shift against its start date. Cross-midnight overlap is
  // deliberately left to a later enhancement; normal same-day shifts are handled here.
  if (firstEnd < firstStart || secondEnd < secondStart) return false;
  return firstStart < secondEnd && secondStart < firstEnd;
}

function detectDiscrepancies(timesheetRows = [], activeStaff = []) {
  const flags = [];
  const matchedRows = timesheetRows.filter((row) => row.matchStatus === "matched" && row.staffId);

  // UC-001 rows that could not be matched or had invalid time data are blockers.
  for (const row of timesheetRows.filter((item) => item.matchStatus !== "matched")) {
    flags.push({
      timesheetId: row.id,
      staffId: row.staffId || null,
      ruleType: "missing_entry",
      expectedValue: null,
      actualValue: toNumber(row.totalHours),
      message: row.matchStatus === "invalid_time"
        ? `Invalid or missing clock-in/out for ${row.rosterRawName || "roster row"}.`
        : `Roster row for ${row.rosterRawName || "unknown staff"} could not be matched to an active staff member.`,
    });
  }

  // Daily cap: one shift row above eight hours.
  for (const row of matchedRows) {
    if (toNumber(row.totalHours) > DAILY_LIMIT_HOURS) {
      flags.push({
        timesheetId: row.id,
        staffId: row.staffId,
        ruleType: "exceeds_cap",
        expectedValue: DAILY_LIMIT_HOURS,
        actualValue: toNumber(row.totalHours),
        message: `${toNumber(row.totalHours)} hours on ${row.shiftDate} exceeds the ${DAILY_LIMIT_HOURS}-hour daily review threshold.`,
      });
    }
  }

  // Overlapping shifts for the same staff member on the same date.
  const byStaffDate = new Map();
  for (const row of matchedRows) {
    if (!row.shiftDate) continue;
    const key = `${row.staffId}__${row.shiftDate}`;
    if (!byStaffDate.has(key)) byStaffDate.set(key, []);
    byStaffDate.get(key).push(row);
  }

  const overlapFlaggedRows = new Set();
  for (const rows of byStaffDate.values()) {
    for (let firstIndex = 0; firstIndex < rows.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < rows.length; secondIndex += 1) {
        if (!shiftsOverlap(rows[firstIndex], rows[secondIndex])) continue;
        for (const row of [rows[firstIndex], rows[secondIndex]]) {
          if (overlapFlaggedRows.has(row.id)) continue;
          overlapFlaggedRows.add(row.id);
          flags.push({
            timesheetId: row.id,
            staffId: row.staffId,
            ruleType: "overlap",
            expectedValue: null,
            actualValue: toNumber(row.totalHours),
            message: `Shift ${row.clockIn || "?"}-${row.clockOut || "?"} on ${row.shiftDate} overlaps another shift for the same staff member.`,
          });
        }
      }
    }
  }

  // Weekly cap across all matched shifts.
  const weeklyTotals = new Map();
  for (const row of matchedRows) {
    if (!row.shiftDate) continue;
    const week = isoWeekKey(row.shiftDate);
    const key = `${row.staffId}__${week}`;
    const current = weeklyTotals.get(key) || { staffId: row.staffId, week, total: 0 };
    current.total += toNumber(row.totalHours);
    weeklyTotals.set(key, current);
  }

  for (const weekly of weeklyTotals.values()) {
    if (weekly.total > WEEKLY_LIMIT_HOURS) {
      flags.push({
        timesheetId: null,
        staffId: weekly.staffId,
        ruleType: "exceeds_cap",
        expectedValue: WEEKLY_LIMIT_HOURS,
        actualValue: Math.round(weekly.total * 100) / 100,
        message: `${Math.round(weekly.total * 100) / 100} hours in ${weekly.week} exceeds the ${WEEKLY_LIMIT_HOURS}-hour weekly review threshold.`,
      });
    }
  }

  // Active staff with no matched row in the selected period.
  const staffWithMatchedRows = new Set(matchedRows.map((row) => row.staffId));
  for (const staff of activeStaff) {
    if (staff.status === "active" && !staffWithMatchedRows.has(staff.id)) {
      flags.push({
        timesheetId: null,
        staffId: staff.id,
        ruleType: "missing_entry",
        expectedValue: null,
        actualValue: 0,
        message: `${staff.externalRef || staff.fullName || "Active staff"} has no matched timesheet entry for this pay period.`,
      });
    }
  }

  return flags;
}

module.exports = {
  DAILY_LIMIT_HOURS,
  WEEKLY_LIMIT_HOURS,
  detectDiscrepancies,
};
