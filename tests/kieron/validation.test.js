const { randomUUID } = require("crypto");
const { pool } = require("../../backend/src/config/database");
const {
  DAILY_LIMIT_HOURS,
  WEEKLY_LIMIT_HOURS,
  detectDiscrepancies,
} = require("../../backend/src/services/validationRulesEngine");
const validationService = require("../../backend/src/services/validationService");

const managerContext = {
  user: { id: null, email: "uc002-test@example.com", role: "manager" },
  ipAddress: "127.0.0.1",
};

describe("UC002 validationRulesEngine", () => {
  test("uses the documented daily and weekly limits", () => {
    expect(DAILY_LIMIT_HOURS).toBe(8);
    expect(WEEKLY_LIMIT_HOURS).toBe(44);
  });

  test("flags a shift above the daily review threshold", () => {
    const flags = detectDiscrepancies([
      {
        id: "row-1",
        staffId: "staff-1",
        shiftDate: "2026-08-03",
        totalHours: 10,
        matchStatus: "matched",
        clockIn: "08:00",
        clockOut: "18:00",
      },
    ], [
      { id: "staff-1", externalRef: "S001", fullName: "Test Staff", status: "active" },
    ]);

    expect(flags).toEqual(expect.arrayContaining([
      expect.objectContaining({
        timesheetId: "row-1",
        staffId: "staff-1",
        ruleType: "exceeds_cap",
        expectedValue: 8,
        actualValue: 10,
      }),
    ]));
  });

  test("flags both rows when same-day shifts overlap", () => {
    const flags = detectDiscrepancies([
      {
        id: "row-1",
        staffId: "staff-1",
        shiftDate: "2026-08-03",
        totalHours: 4,
        matchStatus: "matched",
        clockIn: "08:00",
        clockOut: "12:00",
      },
      {
        id: "row-2",
        staffId: "staff-1",
        shiftDate: "2026-08-03",
        totalHours: 4,
        matchStatus: "matched",
        clockIn: "11:00",
        clockOut: "15:00",
      },
    ], [
      { id: "staff-1", externalRef: "S001", fullName: "Test Staff", status: "active" },
    ]);

    const overlapFlags = flags.filter((flag) => flag.ruleType === "overlap");
    expect(overlapFlags).toHaveLength(2);
    expect(overlapFlags.map((flag) => flag.timesheetId).sort()).toEqual(["row-1", "row-2"]);
  });

  test("flags a weekly total above 44 hours", () => {
    const rows = Array.from({ length: 6 }, (_, index) => ({
      id: `row-${index + 1}`,
      staffId: "staff-1",
      shiftDate: `2026-08-0${index + 3}`,
      totalHours: 8,
      matchStatus: "matched",
      clockIn: "09:00",
      clockOut: "17:00",
    }));

    const flags = detectDiscrepancies(rows, [
      { id: "staff-1", externalRef: "S001", fullName: "Test Staff", status: "active" },
    ]);

    expect(flags).toEqual(expect.arrayContaining([
      expect.objectContaining({
        staffId: "staff-1",
        ruleType: "exceeds_cap",
        expectedValue: 44,
        actualValue: 48,
      }),
    ]));
  });

  test("flags unmatched and invalid-time roster rows as missing entries", () => {
    const flags = detectDiscrepancies([
      {
        id: "row-unmatched",
        staffId: null,
        rosterRawName: "Unknown Name",
        totalHours: 0,
        matchStatus: "unmatched",
      },
      {
        id: "row-invalid",
        staffId: "staff-1",
        rosterRawName: "Test Staff",
        totalHours: 0,
        matchStatus: "invalid_time",
      },
    ], [
      { id: "staff-1", externalRef: "S001", fullName: "Test Staff", status: "active" },
    ]);

    expect(flags.filter((flag) => flag.ruleType === "missing_entry").length).toBeGreaterThanOrEqual(2);
    expect(flags.some((flag) => flag.timesheetId === "row-unmatched")).toBe(true);
    expect(flags.some((flag) => flag.timesheetId === "row-invalid")).toBe(true);
  });

  test("flags an active staff member with no matched timesheet", () => {
    const flags = detectDiscrepancies([], [
      { id: "staff-1", externalRef: "S001", fullName: "Test Staff", status: "active" },
    ]);

    expect(flags).toEqual(expect.arrayContaining([
      expect.objectContaining({
        staffId: "staff-1",
        timesheetId: null,
        ruleType: "missing_entry",
        actualValue: 0,
      }),
    ]));
  });

  test("clean shift data produces no flags", () => {
    const flags = detectDiscrepancies([
      {
        id: "row-1",
        staffId: "staff-1",
        shiftDate: "2026-08-03",
        totalHours: 8,
        matchStatus: "matched",
        clockIn: "09:00",
        clockOut: "17:00",
      },
    ], [
      { id: "staff-1", externalRef: "S001", fullName: "Test Staff", status: "active" },
    ]);

    expect(flags).toEqual([]);
  });
});

describe("UC002 validationService database integration", () => {
  let payPeriodId;
  let staffId;
  let externalRef;

  beforeAll(async () => {
    externalRef = `UC002-${randomUUID().slice(0, 8)}`;

    const period = await pool.query(
      `INSERT INTO pay_period (start_date, end_date, status)
       VALUES ('2098-01-01', '2098-01-14', 'draft')
       RETURNING id`
    );
    payPeriodId = period.rows[0].id;

    const staff = await pool.query(
      `INSERT INTO staff (external_ref, full_name, employment_type, status)
       VALUES ($1, 'UC002 Database Test', 'part_time', 'active')
       RETURNING id`,
      [externalRef]
    );
    staffId = staff.rows[0].id;

    await pool.query(
      `INSERT INTO timesheet
        (pay_period_id, staff_id, shift_date, total_hours, match_status, match_method, clock_in, clock_out)
       VALUES ($1, $2, '2098-01-03', 10, 'matched', 'id', '08:00', '18:00')`,
      [payPeriodId, staffId]
    );
  });

  afterAll(async () => {
    if (payPeriodId) {
      await pool.query("DELETE FROM timesheet_exception WHERE pay_period_id = $1", [payPeriodId]);
      await pool.query("DELETE FROM timesheet WHERE pay_period_id = $1", [payPeriodId]);
      await pool.query("DELETE FROM audit_log WHERE entity_type = 'pay_period' AND entity_id = $1", [payPeriodId]);
      await pool.query("DELETE FROM pay_period WHERE id = $1", [payPeriodId]);
    }
    if (staffId) {
      await pool.query("DELETE FROM staff WHERE id = $1", [staffId]);
    }
    await pool.end();
  });

  test("runs validation and returns the flagged employee in review data", async () => {
    const run = await validationService.runValidation(payPeriodId, managerContext);

    expect(run.success).toBe(true);
    expect(run.detected).toBeGreaterThan(0);
    expect(run.newlyFlagged).toBeGreaterThan(0);

    const review = await validationService.getReview(payPeriodId);
    const person = review.staff.find((item) => item.staffId === externalRef);

    expect(person).toBeDefined();
    expect(person.status).toBe("Flagged");
    expect(person.flags.some((flag) => flag.flagType === "exceeds_cap")).toBe(true);
    expect(review.canValidate).toBe(false);
  });
});
