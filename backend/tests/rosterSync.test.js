jest.mock("../src/config/database", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));
jest.mock("../src/adapters/googleSheetsAdapter", () => ({ fetchRosterRows: jest.fn() }));
jest.mock("../src/services/payPeriodService", () => ({ getActivePayPeriod: jest.fn(), getPayPeriod: jest.fn() }));
jest.mock("../src/services/auditService", () => ({ logAction: jest.fn() }));

const { pool } = require("../src/config/database");
const { fetchRosterRows } = require("../src/adapters/googleSheetsAdapter");
const payPeriodService = require("../src/services/payPeriodService");
const auditService = require("../src/services/auditService");
const { calculateHours } = require("../src/utils/hoursCalculator");
const { runRosterSync, resolveException, undoException, resetPeriodResolutions } = require("../src/services/rosterSyncService");

const payPeriodId = "11111111-1111-1111-1111-111111111111";
const client = { query: jest.fn(), release: jest.fn() };

function configureDatabase({ staffById = {}, staffByName = {}, summaryRows = [], resolvedRows = [] } = {}) {
  let summaryCall = 0;
  pool.connect.mockResolvedValue(client);
  pool.query.mockImplementation(async (sql, params) => {
    if (sql.includes("FROM staff WHERE external_ref")) return { rows: staffById[params[0]] ? [staffById[params[0]]] : [] };
    if (sql.includes("FROM staff WHERE lower(full_name)")) return { rows: staffByName[params[0].toLowerCase()] ? [staffByName[params[0].toLowerCase()]] : [] };
    if (sql.includes("resolved_manually = true")) {
      return {
        rows: sql.includes("to_char(shift_date, 'YYYY-MM-DD') AS shift_date")
          ? resolvedRows.map((row) => ({ ...row, shift_date: row.shift_date instanceof Date ? row.shift_date.toISOString().slice(0, 10) : row.shift_date }))
          : resolvedRows,
      };
    }
    if (sql.includes("FROM timesheet t")) return { rows: summaryCall++ === 0 ? [] : summaryRows };
    throw new Error(`Unexpected pool query: ${sql}`);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  client.query.mockResolvedValue({ rows: [] });
  configureDatabase();
  // Default: a period that covers every existing test's sample dates
  // (2026-08-01 onward), so old tests keep passing unless a test
  // explicitly overrides this.
  payPeriodService.getPayPeriod.mockResolvedValue({
    id: payPeriodId,
    startDate: "2026-08-01",
    endDate: "2026-08-14",
  });
});

describe("calculateHours", () => {
  test("returns NaN for missing or invalid clock times", () => {
    expect(Number.isNaN(calculateHours("08:00", undefined))).toBe(true);
    expect(Number.isNaN(calculateHours("not-a-time", "17:00"))).toBe(true);
  });

  test("calculates overnight shifts", () => {
    expect(calculateHours("22:00", "06:00")).toBe(8);
  });
});

describe("runRosterSync", () => {
  test("matches a staff member by staff ID before checking their name", async () => {
    configureDatabase({
      staffById: { S007: { id: "staff-7", staffId: "S007", fullName: "Farah Yusof", status: "active" } },
      summaryRows: [{ staff_ext_ref: "S007", full_name: "Farah Yusof", total_hours: 9, match_status: "matched", match_method: "id", shift_date: "2026-08-01", clock_in: "08:00", clock_out: "17:00", updated_at: new Date() }],
    });
    fetchRosterRows.mockResolvedValue([{ "Staff ID": "S007", "Staff Name": "Farrah Yusof", Date: "2026-08-01", "Clock In": "08:00", "Clock Out": "17:00" }]);

    await runRosterSync(payPeriodId);

    expect(pool.query).toHaveBeenCalledTimes(4);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("'matched'"), [payPeriodId, "staff-7", "2026-08-01", 9, "id", "08:00", "17:00"]);
  });

  test("uses name matching when no staff-ID match exists", async () => {
    configureDatabase({
      staffByName: { "andrea chua": { id: "staff-1", staffId: "S001", fullName: "Andrea Chua", status: "active" } },
      summaryRows: [{ staff_ext_ref: "S001", full_name: "Andrea Chua", total_hours: 8, match_status: "matched", match_method: "name", shift_date: "2026-08-01", clock_in: "09:00", clock_out: "17:00", updated_at: new Date() }],
    });
    fetchRosterRows.mockResolvedValue([{ "Staff ID": "UNKNOWN", "Staff Name": "Andrea Chua", Date: "2026-08-01", "Clock In": "09:00", "Clock Out": "17:00" }]);

    await runRosterSync(payPeriodId);

    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("'matched'"), [payPeriodId, "staff-1", "2026-08-01", 8, "name", "09:00", "17:00"]);
  });

  test("stores unknown staff as unmatched and excludes them from matched totals", async () => {
    configureDatabase({
      summaryRows: [{ staff_ext_ref: null, roster_raw_name: "Unknown Person", total_hours: 8, match_status: "unmatched", shift_date: "2026-08-01", updated_at: new Date() }],
    });
    fetchRosterRows.mockResolvedValue([{ "Staff ID": "S999", "Staff Name": "Unknown Person", Date: "2026-08-01", "Clock In": "09:00", "Clock Out": "17:00" }]);

    const result = await runRosterSync(payPeriodId);

    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("'unmatched'"), [payPeriodId, "Unknown Person", "2026-08-01", 8, "Unknown Person"]);
    expect(result).toMatchObject({ staffSynced: 0, totalHours: 0, unmatchedCount: 1 });
  });

  test("stores missing clock times as invalid_time instead of failing the whole sync", async () => {
    configureDatabase({
      staffById: { S001: { id: "staff-1", staffId: "S001", fullName: "Andrea Chua", status: "active" } },
      summaryRows: [{ staff_ext_ref: "S001", roster_raw_name: "Andrea Chua (missing clock-in/out)", match_status: "invalid_time", shift_date: "2026-08-01", updated_at: new Date() }],
    });
    fetchRosterRows.mockResolvedValue([{ "Staff ID": "S001", "Staff Name": "Andrea Chua", Date: "2026-08-01", "Clock In": "08:00", "Clock Out": "" }]);

    const result = await runRosterSync(payPeriodId);

    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("'invalid_time'"), [payPeriodId, "staff-1", "Andrea Chua (missing clock-in/out)", "2026-08-01", "Andrea Chua"]);
    expect(result.invalidTimeCount).toBe(1);
  });

  test("runs the complete sync flow and records a scheduler audit event", async () => {
    configureDatabase({
      staffById: { S001: { id: "staff-1", staffId: "S001", fullName: "Andrea Chua", status: "active" } },
      summaryRows: [{ staff_ext_ref: "S001", full_name: "Andrea Chua", total_hours: 9, match_status: "matched", match_method: "id", shift_date: "2026-08-01", clock_in: "08:00", clock_out: "17:00", updated_at: new Date() }],
    });
    fetchRosterRows.mockResolvedValue([{ "Staff ID": "S001", "Staff Name": "Andrea Chua", Date: "2026-08-01", "Clock In": "08:00", "Clock Out": "17:00" }]);

    const result = await runRosterSync(payPeriodId, "scheduler");

    expect(client.query).toHaveBeenCalledWith("BEGIN");
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(auditService.logAction).toHaveBeenCalledWith(expect.objectContaining({ action: "roster_synced", actor: "scheduler", entityId: payPeriodId }));
    expect(result).toMatchObject({ success: true, staffSynced: 1, totalHours: 9 });
  });

  test("preserves a manually resolved, unfrozen row during a new sync", async () => {
    configureDatabase({
      staffById: { S001: { id: "staff-1", staffId: "S001", fullName: "Andrea Chua", status: "active" } },
      summaryRows: [{ staff_ext_ref: "S001", full_name: "Andrea Chua", total_hours: 9, match_status: "matched", match_method: "manual", shift_date: "2026-08-01", clock_in: "08:00", clock_out: "17:00", is_frozen: false, resolved_manually: true, updated_at: new Date() }],
    });
    fetchRosterRows.mockResolvedValue([{ "Staff ID": "S001", "Staff Name": "Andrea Chua", Date: "2026-08-01", "Clock In": "08:00", "Clock Out": "17:00" }]);

    await runRosterSync(payPeriodId);

    expect(client.query).toHaveBeenCalledWith(
      "DELETE FROM timesheet WHERE pay_period_id = $1 AND is_frozen = false AND resolved_manually = false",
      [payPeriodId]
    );
  });

  test("does not recreate a resolved unmatched entry while adding a new unmatched entry", async () => {
    configureDatabase({
      resolvedRows: [{ shift_date: new Date("2026-08-01T00:00:00Z"), source_key: "Resolved Person" }],
      summaryRows: [{ staff_ext_ref: null, roster_raw_name: "New Person", total_hours: 8, match_status: "unmatched", shift_date: "2026-08-01", updated_at: new Date() }],
    });
    fetchRosterRows.mockResolvedValue([
      { "Staff ID": "S999", "Staff Name": "Resolved Person", Date: "2026-08-01", "Clock In": "09:00", "Clock Out": "17:00" },
      { "Staff ID": "S998", "Staff Name": "New Person", Date: "2026-08-01", "Clock In": "09:00", "Clock Out": "17:00" },
    ]);

    await runRosterSync(payPeriodId);

    const unmatchedInserts = client.query.mock.calls.filter(([sql]) => sql.includes("'unmatched'"));
    expect(unmatchedInserts).toHaveLength(1);
    expect(unmatchedInserts[0][1]).toEqual([payPeriodId, "New Person", "2026-08-01", 8, "New Person"]);
  });

  test("excludes roster rows that fall outside the pay period's date range", async () => {
    configureDatabase({
      staffById: { S001: { id: "staff-1", staffId: "S001", fullName: "Andrea Chua", status: "active" } },
    });
    fetchRosterRows.mockResolvedValue([
      { "Staff ID": "S001", "Staff Name": "Andrea Chua", Date: "2026-07-15", "Clock In": "08:00", "Clock Out": "17:00" }, // before period
      { "Staff ID": "S001", "Staff Name": "Andrea Chua", Date: "2026-08-20", "Clock In": "08:00", "Clock Out": "17:00" }, // after period
    ]);

    const result = await runRosterSync(payPeriodId);

    const insertCalls = client.query.mock.calls.filter(([sql]) => sql.includes("INSERT INTO timesheet"));
    expect(insertCalls).toHaveLength(0);
    expect(result.success).toBe(false);
  });

  test("returns PAY_PERIOD_NOT_FOUND when the pay period does not exist", async () => {
    payPeriodService.getPayPeriod.mockResolvedValue(null);

    const result = await runRosterSync(payPeriodId);

    expect(result).toMatchObject({ success: false, error: "PAY_PERIOD_NOT_FOUND" });
    expect(fetchRosterRows).not.toHaveBeenCalled();
  });

  test("returns ACTIVE_PAY_PERIOD_NOT_FOUND when no active pay period exists", async () => {
    payPeriodService.getActivePayPeriod.mockResolvedValue(null);

    const result = await runRosterSync();

    expect(result).toMatchObject({ success: false, error: "ACTIVE_PAY_PERIOD_NOT_FOUND" });
    expect(fetchRosterRows).not.toHaveBeenCalled();
  });
});

describe("resolveException", () => {
  test("links an unmatched row to an active staff member", async () => {
    const timesheetRowId = "22222222-2222-2222-2222-222222222222";
    const staffId = "33333333-3333-3333-3333-333333333333";
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: timesheetRowId, match_status: "unmatched", is_frozen: false }] })
      .mockResolvedValueOnce({ rows: [{ id: staffId }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await resolveException(timesheetRowId, { staffId });

    expect(result).toEqual({ success: true, timesheetRowId, resolution: "staff_linked" });
    expect(pool.query).toHaveBeenLastCalledWith(expect.stringContaining("match_method = 'manual', resolved_manually = true"), [staffId, timesheetRowId]);
  });

  test("updates clock times for an invalid-time row", async () => {
    const timesheetRowId = "22222222-2222-2222-2222-222222222222";
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: timesheetRowId, match_status: "invalid_time", is_frozen: false }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await resolveException(timesheetRowId, { clockIn: "08:30", clockOut: "17:00" });

    expect(result).toEqual({ success: true, timesheetRowId, resolution: "clock_times_updated" });
    expect(pool.query).toHaveBeenLastCalledWith(expect.stringContaining("total_hours = $3, match_status = 'matched', resolved_manually = true"), ["08:30", "17:00", 8.5, timesheetRowId]);
  });

  test("permanently ignores an exception row", async () => {
    const timesheetRowId = "22222222-2222-2222-2222-222222222222";
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: timesheetRowId, match_status: "unmatched", is_frozen: false }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await resolveException(timesheetRowId, { ignore: true });

    expect(result).toEqual({ success: true, timesheetRowId, resolution: "ignored" });
    expect(pool.query).toHaveBeenLastCalledWith(expect.stringContaining("match_status = 'ignored', resolved_manually = true"), [timesheetRowId]);
  });

  test("rejects resolving a frozen timesheet row", async () => {
    const timesheetRowId = "22222222-2222-2222-2222-222222222222";
    pool.query.mockResolvedValueOnce({ rows: [{ id: timesheetRowId, match_status: "unmatched", is_frozen: true }] });

    const result = await resolveException(timesheetRowId, { ignore: true });

    expect(result).toMatchObject({ success: false, error: "TIMESHEET_ROW_FROZEN" });
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});

describe("undoException", () => {
  const timesheetRowId = "22222222-2222-2222-2222-222222222222";

  test("reverts a staff-link resolution", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: timesheetRowId, match_status: "matched", is_frozen: false, clock_in: null, total_hours: 8 }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await undoException(timesheetRowId);

    expect(result).toEqual({ success: true, timesheetRowId, resolution: "staff_link_reverted" });
    expect(pool.query).toHaveBeenLastCalledWith(expect.stringContaining("staff_id = NULL, roster_raw_name = source_key, match_status = 'unmatched', resolved_manually = false"), [timesheetRowId]);
  });

  test("reverts a clock-time fix", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: timesheetRowId, match_status: "matched", is_frozen: false, clock_in: "08:30", total_hours: 8.5 }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await undoException(timesheetRowId);

    expect(result).toEqual({ success: true, timesheetRowId, resolution: "clock_times_reverted" });
    expect(pool.query).toHaveBeenLastCalledWith(expect.stringContaining("clock_in = NULL, clock_out = NULL, total_hours = 0, match_status = 'invalid_time', resolved_manually = false"), [timesheetRowId]);
  });

  test.each([
    [0, "invalid_time"],
    [8, "unmatched"],
  ])("reverts an ignored %s-hour row to %s", async (totalHours, expectedStatus) => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: timesheetRowId, match_status: "ignored", is_frozen: false, clock_in: null, total_hours: totalHours }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await undoException(timesheetRowId);

    expect(result).toEqual({ success: true, timesheetRowId, resolution: `${expectedStatus}_reverted` });
    expect(pool.query).toHaveBeenLastCalledWith(expect.stringContaining("SET match_status = $1, resolved_manually = false"), [expectedStatus, timesheetRowId]);
  });

  test("rejects undoing a frozen row", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: timesheetRowId, match_status: "ignored", is_frozen: true, clock_in: null, total_hours: 8 }] });

    const result = await undoException(timesheetRowId);

    expect(result).toMatchObject({ success: false, error: "TIMESHEET_ROW_FROZEN" });
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});

describe("resetPeriodResolutions", () => {
  test("deletes manually resolved rows before running a fresh manual sync", async () => {
    configureDatabase({
      staffById: { S001: { id: "staff-1", staffId: "S001", fullName: "Andrea Chua", status: "active" } },
      summaryRows: [{ staff_ext_ref: "S001", full_name: "Andrea Chua", total_hours: 8, match_status: "matched", match_method: "id", shift_date: "2026-08-01", clock_in: "09:00", clock_out: "17:00", updated_at: new Date() }],
    });
    pool.query.mockResolvedValueOnce({ rows: [] });
    fetchRosterRows.mockResolvedValue([{ "Staff ID": "S001", "Staff Name": "Andrea Chua", Date: "2026-08-01", "Clock In": "09:00", "Clock Out": "17:00" }]);

    const result = await resetPeriodResolutions(payPeriodId);

    expect(pool.query).toHaveBeenNthCalledWith(1, "DELETE FROM timesheet WHERE pay_period_id = $1 AND resolved_manually = true", [payPeriodId]);
    expect(fetchRosterRows).toHaveBeenCalledTimes(1);
    expect(auditService.logAction).toHaveBeenCalledWith(expect.objectContaining({ action: "roster_synced", actor: "manual", entityId: payPeriodId }));
    expect(result).toMatchObject({ success: true, staffSynced: 1, totalHours: 8 });
  });
});
