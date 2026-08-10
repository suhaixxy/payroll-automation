const { start, isPayPeriodGenerationEnabled } = require("../src/server");
const { pool } = require("../src/config/database");

function dependencies(env = {}) {
  const server = { close: jest.fn() };
  return {
    server,
    waitForDb: jest.fn().mockResolvedValue(undefined),
    migrate: jest.fn().mockResolvedValue(undefined),
    generatePayPeriods: jest.fn().mockResolvedValue({
      message: "Pay-period generation completed (2 created, 0 existing or overlapping)",
    }),
    listen: jest.fn((port, callback) => {
      callback();
      return server;
    }),
    startScheduler: jest.fn(),
    env,
    log: jest.fn(),
  };
}

afterAll(async () => {
  await pool.end();
});

describe("backend startup sequencing", () => {
  test("database readiness must succeed before migrations or listening", async () => {
    const deps = dependencies();
    deps.waitForDb.mockRejectedValue(new Error("database unavailable"));

    await expect(start(deps)).rejects.toThrow("database unavailable");
    expect(deps.migrate).not.toHaveBeenCalled();
    expect(deps.generatePayPeriods).not.toHaveBeenCalled();
    expect(deps.listen).not.toHaveBeenCalled();
    expect(deps.startScheduler).not.toHaveBeenCalled();
  });

  test("generation is disabled by default and startup creates no draft periods", async () => {
    const deps = dependencies({ PORT: "5001" });

    await expect(start(deps)).resolves.toBe(deps.server);
    expect(deps.waitForDb).toHaveBeenCalledTimes(1);
    expect(deps.migrate).toHaveBeenCalledTimes(1);
    expect(deps.generatePayPeriods).not.toHaveBeenCalled();
    expect(deps.listen).toHaveBeenCalledWith("5001", expect.any(Function));
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("generation skipped"));
  });

  test("explicit true enables generation after migrations and before listening", async () => {
    const deps = dependencies({ GENERATE_PAY_PERIODS_ON_STARTUP: "true", PORT: "5002" });
    const callOrder = [];
    deps.waitForDb.mockImplementation(async () => callOrder.push("ready"));
    deps.migrate.mockImplementation(async () => callOrder.push("migrate"));
    deps.generatePayPeriods.mockImplementation(async () => {
      callOrder.push("generate");
      return { message: "explicit generation complete" };
    });
    deps.listen.mockImplementation((port, callback) => {
      callOrder.push("listen");
      callback();
      return deps.server;
    });

    await start(deps);
    expect(callOrder).toEqual(["ready", "migrate", "generate", "listen"]);
    expect(deps.generatePayPeriods).toHaveBeenCalledTimes(1);
    expect(deps.log).toHaveBeenCalledWith("[startup] Pay-period generation explicitly enabled");
  });

  test("only the exact value true enables startup generation", () => {
    expect(isPayPeriodGenerationEnabled({})).toBe(false);
    expect(isPayPeriodGenerationEnabled({ GENERATE_PAY_PERIODS_ON_STARTUP: "false" })).toBe(false);
    expect(isPayPeriodGenerationEnabled({ GENERATE_PAY_PERIODS_ON_STARTUP: "TRUE" })).toBe(false);
    expect(isPayPeriodGenerationEnabled({ GENERATE_PAY_PERIODS_ON_STARTUP: "true" })).toBe(true);
  });
});
