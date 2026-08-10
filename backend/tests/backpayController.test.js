jest.mock("../src/config/database", () => ({
  pool: { query: jest.fn() },
}));

const { pool } = require("../src/config/database");
const backpayController = require("../src/controllers/backpayController");

const staffId = "11111111-1111-1111-1111-111111111111";
const payPeriodId = "22222222-2222-2222-2222-222222222222";
const reportId = "33333333-3333-3333-3333-333333333333";

function createResponse() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("backpayController", () => {
  describe("create", () => {
    test("creates a missing-hours report for a part-time staff member", async () => {
      const body = {
        staff_id: staffId,
        pay_period_id: payPeriodId,
        missing_regular_hours: 8,
        missing_ot_hours: 2,
      };
      const report = { id: reportId, staffId, payPeriodId, reportType: "missing_hours", missingHours: 10, missingRegularHours: 8, missingOtHours: 2, status: "pending" };
      pool.query
        .mockResolvedValueOnce({ rows: [{ employment_type: "part_time", date_joined: "2026-01-01" }] })
        .mockResolvedValueOnce({ rows: [{ start_date: "2026-02-01" }] })
        .mockResolvedValueOnce({ rows: [report] });
      const res = createResponse();

      await backpayController.create({ body }, res, jest.fn());

      expect(pool.query).toHaveBeenNthCalledWith(3, expect.stringContaining("INSERT INTO backpay_report"), [staffId, payPeriodId, "missing_hours", 10, 8, 2, null]);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(report);
    });

    test("creates a missing-performance-input report for a full-time staff member", async () => {
      const body = {
        staff_id: staffId,
        pay_period_id: payPeriodId,
        description: "3 sessions not recorded",
      };
      const report = { id: reportId, staffId, payPeriodId, reportType: "missing_performance_input", description: body.description, status: "pending" };
      pool.query
        .mockResolvedValueOnce({ rows: [{ employment_type: "full_time", date_joined: null }] })
        .mockResolvedValueOnce({ rows: [{ start_date: "2026-02-01" }] })
        .mockResolvedValueOnce({ rows: [report] });
      const res = createResponse();

      await backpayController.create({ body }, res, jest.fn());

      expect(pool.query).toHaveBeenNthCalledWith(3, expect.stringContaining("INSERT INTO backpay_report"), [staffId, payPeriodId, "missing_performance_input", null, null, null, body.description]);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(report);
    });

    test("rejects missing regular hours on a full-time staff report", async () => {
      const next = jest.fn();
      pool.query
        .mockResolvedValueOnce({ rows: [{ employment_type: "full_time", date_joined: null }] })
        .mockResolvedValueOnce({ rows: [{ start_date: "2026-02-01" }] });

      await backpayController.create({ body: { staff_id: staffId, pay_period_id: payPeriodId, missing_regular_hours: 8, description: "3 sessions not recorded" } }, createResponse(), next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    test("rejects a pay period before the staff member's date joined", async () => {
      const next = jest.fn();
      pool.query
        .mockResolvedValueOnce({ rows: [{ employment_type: "part_time", date_joined: "2026-02-01" }] })
        .mockResolvedValueOnce({ rows: [{ start_date: "2026-01-01" }] });

      await backpayController.create({ body: { staff_id: staffId, pay_period_id: payPeriodId, missing_regular_hours: 8 } }, createResponse(), next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
      expect(pool.query).toHaveBeenCalledTimes(2);
    });
  });

  describe("list", () => {
    test("returns reports filtered by pending status", async () => {
      const reports = [{ id: reportId, staffId, payPeriodId, staffName: "Andrea Chua", status: "pending" }];
      pool.query.mockResolvedValue({ rows: reports });
      const res = createResponse();

      await backpayController.list({ query: { status: "pending" } }, res, jest.fn());

      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("br.status = $1"), ["pending"]);
      expect(res.json).toHaveBeenCalledWith(reports);
    });
  });

  describe("resolve", () => {
    test("resolves a pending backpay report", async () => {
      const resolvedReport = { id: reportId, status: "resolved" };
      pool.query
        .mockResolvedValueOnce({ rows: [{ status: "pending" }] })
        .mockResolvedValueOnce({ rows: [resolvedReport] });
      const res = createResponse();

      await backpayController.resolve({ params: { id: reportId } }, res, jest.fn());

      expect(pool.query).toHaveBeenNthCalledWith(2, expect.stringContaining("SET status = 'resolved', resolved_at = now()"), [reportId]);
      expect(res.json).toHaveBeenCalledWith(resolvedReport);
    });

    test("rejects resolving an already resolved report", async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ status: "resolved" }] });
      const next = jest.fn();

      await backpayController.resolve({ params: { id: reportId } }, createResponse(), next);

      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
    });
  });
});
