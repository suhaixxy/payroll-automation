// discrepancyRules.js
// this is basically the "rules" for UC-002 - checking the timesheets for anything weird
// before payroll gets calculated. kept these as plain functions (no db stuff) so i can
// just test them straight up without needing postgres running or anything

const DAILY_LIMIT_HOURS = 8;
const WEEKLY_LIMIT_HOURS = 44;

// takes in the timesheet rows for a pay period + the list of active staff,
// spits out an array of "flags" (aka problems it found)
// timesheetRows looks like: [{ id, staffId, workDate, hours }]
// activeStaff looks like: [{ id, externalRef, fullName, status }]
function detectDiscrepancies(timesheetRows, activeStaff) {
  const flags = [];

  // check 1: duplicate entries
  // if someone has 2+ rows for the exact same date something went wrong with the import
  const byStaffDate = new Map();
  for (const row of timesheetRows) {
    const key = `${row.staffId}__${row.workDate}`;
    if (!byStaffDate.has(key)) byStaffDate.set(key, []);
    byStaffDate.get(key).push(row);
  }
  for (const rows of byStaffDate.values()) {
    if (rows.length > 1) {
      // flag every duplicate row, not just the extra one, so staff can pick which is correct
      for (const row of rows) {
        flags.push({
          timesheetId: row.id,
          staffId: row.staffId,
          flagType: 'DUPLICATE_ENTRY',
          expectedValue: null,
          actualValue: row.hours,
        });
      }
    }
  }

  // check 2: daily overtime
  // anything over 8 hrs in one day gets flagged
  for (const row of timesheetRows) {
    if (Number(row.hours) > DAILY_LIMIT_HOURS) {
      flags.push({
        timesheetId: row.id,
        staffId: row.staffId,
        flagType: 'OVERTIME_DAILY',
        expectedValue: DAILY_LIMIT_HOURS,
        actualValue: row.hours,
      });
    }
  }

  // check 3: weekly overtime
  // gotta add up all the hours per staff per week first, then check if it goes over 44
  const weeklyTotals = new Map();
  for (const row of timesheetRows) {
    const week = isoWeekKey(row.workDate); // grouping by week so it doesnt matter which day the period starts on
    const key = `${row.staffId}__${week}`;
    weeklyTotals.set(key, (weeklyTotals.get(key) || 0) + Number(row.hours));
  }
  for (const [key, total] of weeklyTotals) {
    if (total > WEEKLY_LIMIT_HOURS) {
      const staffId = Number(key.split('__')[0]);
      flags.push({
        timesheetId: null, // no single row caused this, its the total, so no id here
        staffId,
        flagType: 'OVERTIME_WEEKLY',
        expectedValue: WEEKLY_LIMIT_HOURS,
        actualValue: total,
      });
    }
  }

  // check 4: missing entries
  // basically - is there an active staff member who has literally 0 hours logged this period?
  // probably means their shifts didnt get pulled in properly during UC-001
  const staffWithEntries = new Set(timesheetRows.map((r) => r.staffId));
  for (const staff of activeStaff) {
    if (staff.status === 'active' && !staffWithEntries.has(staff.id)) {
      flags.push({
        timesheetId: null,
        staffId: staff.id,
        flagType: 'MISSING_ENTRY',
        expectedValue: null,
        actualValue: 0,
      });
    }
  }

  return flags;
}

// this is just figuring out which mon-sun "week" a date falls into
// using iso weeks (not just calendar weeks) so it doesnt get messed up if the
// pay period starts halfway through a week
function isoWeekKey(dateStr) {
  const date = new Date(dateStr);
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / (7 * 24 * 3600 * 1000));
  return `${date.getFullYear()}-W${week}`;
}

module.exports = { detectDiscrepancies, DAILY_LIMIT_HOURS, WEEKLY_LIMIT_HOURS };
