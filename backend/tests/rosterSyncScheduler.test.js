jest.mock("../src/services/rosterSyncService", () => ({
  runRosterSync: jest.fn(),
}));

const rosterSyncService = require("../src/services/rosterSyncService");
const { runIfDue } = require("../src/jobs/rosterSyncScheduler");

beforeEach(() => {
  jest.clearAllMocks();
  rosterSyncService.runRosterSync.mockResolvedValue(undefined);
});

describe("rosterSyncScheduler", () => {
  test("triggers a roster sync at midnight", () => {
    runIfDue(new Date(2026, 0, 1, 0, 0));

    expect(rosterSyncService.runRosterSync).toHaveBeenCalledWith(undefined, "scheduler");
  });

  test("does not trigger a second sync for the same date", () => {
    const midnight = new Date(2026, 0, 2, 0, 0);

    runIfDue(midnight);
    runIfDue(midnight);

    expect(rosterSyncService.runRosterSync).toHaveBeenCalledTimes(1);
  });

  test("does not trigger a sync outside the midnight schedule", () => {
    runIfDue(new Date(2026, 0, 3, 0, 1));

    expect(rosterSyncService.runRosterSync).not.toHaveBeenCalled();
  });

  test("logs a scheduled sync failure", async () => {
    const error = new Error("Sheet unavailable");
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    rosterSyncService.runRosterSync.mockRejectedValue(error);

    runIfDue(new Date(2026, 0, 4, 0, 0));
    await new Promise((resolve) => setImmediate(resolve));

    expect(consoleError).toHaveBeenCalledWith(
      "[rosterSyncScheduler] Scheduled sync failed:",
      "Sheet unavailable",
    );
    consoleError.mockRestore();
  });
});
