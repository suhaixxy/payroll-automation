const mockQuery = jest.fn();
const mockRelease = jest.fn();
const mockClient = { query: mockQuery, release: mockRelease };
const mockPool = { connect: jest.fn().mockResolvedValue(mockClient), query: jest.fn() };

jest.mock("../src/config/database", () => ({ pool: mockPool }));

const payPeriodService = require("../src/services/payPeriodService");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("explicit pay-period generation", () => {
  test("creates requested periods transactionally and reports skipped overlaps", async () => {
    mockQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({}) // advisory lock
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({}); // COMMIT

    const result = await payPeriodService.ensurePayPeriodsSeeded({ periodCount: 2 });

    expect(result).toMatchObject({ createdCount: 1 });
    expect(result.message).toContain("1 existing or overlapping");
    expect(mockQuery.mock.calls[2][0]).toContain("NOT EXISTS");
    expect(mockQuery.mock.calls[2][1]).toEqual(["2026-01-01", "2026-01-14"]);
    expect(mockQuery.mock.calls[3][1]).toEqual(["2026-01-15", "2026-01-28"]);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  test("rolls back and releases the connection when generation fails", async () => {
    mockQuery
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("insert failed"))
      .mockResolvedValueOnce({});

    await expect(payPeriodService.ensurePayPeriodsSeeded({ periodCount: 1 })).rejects.toThrow("insert failed");
    expect(mockQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});

describe("active pay-period selection", () => {
  test("uses an explicit deterministic order when historical overlaps exist", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: "chosen" }] });

    await expect(payPeriodService.getActivePayPeriod()).resolves.toEqual({ id: "chosen" });
    expect(mockPool.query.mock.calls[0][0]).toContain("ORDER BY start_date DESC, end_date ASC, id ASC");
  });
});
