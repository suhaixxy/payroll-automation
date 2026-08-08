// Placeholder (scaffold) — an empty file fails the whole jest run, so this
// carries a todo until the UC-002 owner adds real tests.
test.todo('UC-002 timesheet validation tests (owner: UC-002)');
const { randomUUID } = require("crypto");
const { pool } = require("../src/config/database");
const { detectDiscrepancies } = require("../src/services/validationRulesEngine");
const validationService = require("../src/services/validationService");

const managerContext = {
  user: { id: null, email: "uc002-test@example.com", role: "manager" },
  ipAddress: "127.0.0.1",
};

describe("validationRulesEngine", () => {
  test("flags a shift above the daily review threshold", () => {
    const flags = detectDiscrepancies([
      { id: "row-1", staffId: "staff-1", shiftDate: "2026-08-03", totalHours: 10, matchStatus: "matched", clockIn: "08:00", clockOut: "18:00" },
    ], [
      { id: "staff-1", externalRef: "S001", fullName: "Test Staff", status: "active" },
    ]);
    expect(flags.some((flag) => flag.ruleType === "exceeds_cap")).toBe(true);
  });

  test("flags overlapping shifts", () => {
    const flags = detectDiscrepancies([
      { id: "row-1", staffId: "staff-1", shiftDate: "2026-08-03", totalHours: 4, matchStatus: "matched", clockIn: "08:00", clockOut: "12:00" },
      { id: "row-2", staffId: "staff-1", shiftDate: "2026-08-03", totalHours: 4, matchStatus: "matched", clockIn: "11:00", clockOut: "15:00" },
    ], [
      { id: "staff-1", externalRef: "S001", fullName: "Test Staff", status: "active" },
    ]);
    expect(flags.filter((flag) => flag.ruleType === "overlap")).toHaveLength(2);
  });

  test("flags an active staff member with no matched timesheet", () => {
    const flags = detectDiscrepancies([], [
      { id: "staff-1", externalRef: "S001", fullName: "Test Staff", status: "active" },
    ]);
    expect(flags.some((flag) => flag.ruleType === "missing_entry")).toBe(true);
  });

  test("clean shift data produces no flags", () => {
    const flags = detectDiscrepancies([
      { id: "row-1", staffId: "staff-1", shiftDate: "2026-08-03", totalHours: 8, matchStatus: "matched", clockIn: "09:00", clockOut: "17:00" },
    ], [
      { id: "staff-1", externalRef: "S001", fullName: "Test Staff", status: "active" },
    ]);
    expect(flags).toEqual([]);
  });
});

describe("validationService database integration", () => {
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
    await pool.query("DELETE FROM timesheet_exception WHERE pay_period_id = $1", [payPeriodId]);
    await pool.query("DELETE FROM timesheet WHERE pay_period_id = $1", [payPeriodId]);
    await pool.query("DELETE FROM audit_log WHERE entity_type = 'pay_period' AND entity_id = $1", [payPeriodId]);
    await pool.query("DELETE FROM pay_period WHERE id = $1", [payPeriodId]);
    await pool.query("DELETE FROM staff WHERE id = $1", [staffId]);
    await pool.end();
  });

  test("runs validation and returns the test staff in review data", async () => {
    const run = await validationService.runValidation(payPeriodId, managerContext);
    expect(run.success).toBe(true);
    expect(run.detected).toBeGreaterThan(0);

    const review = await validationService.getReview(payPeriodId);
    const person = review.staff.find((item) => item.staffId === externalRef);
    expect(person).toBeDefined();
    expect(person.flags.some((flag) => flag.flagType === "exceeds_cap")).toBe(true);
  });
});
