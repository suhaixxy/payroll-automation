jest.mock("../src/services/rosterSyncService", () => ({
  runRosterSync: jest.fn(),
  getLastSyncResult: jest.fn(),
  getSyncHistory: jest.fn(),
}));

const rosterSyncService = require("../src/services/rosterSyncService");
const { importNow, getSyncSummary, getSyncHistory } = require("../src/controllers/rosterController");

const payPeriodId = "11111111-1111-1111-1111-111111111111";

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

describe("rosterController", () => {
  describe("importNow", () => {
    test("returns a successful manual sync result", async () => {
      const result = { success: true, payPeriodId, staffSynced: 2, totalHours: 16 };
      rosterSyncService.runRosterSync.mockResolvedValue(result);
      const res = createResponse();
      const next = jest.fn();

      await importNow({ body: { payPeriodId } }, res, next);

      expect(rosterSyncService.runRosterSync).toHaveBeenCalledWith(payPeriodId, "manual");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(result);
      expect(next).not.toHaveBeenCalled();
    });

    test.each([
      ["ROSTER_SOURCE_UNREACHABLE", "Google Sheet could not be read; previous draft retained"],
      ["PAY_PERIOD_NOT_FOUND", "The selected pay period does not exist"],
      ["ACTIVE_PAY_PERIOD_NOT_FOUND", "No active pay period is available"],
    ])("surfaces a %s sync failure", async (error, message) => {
      const result = { success: false, error, message };
      rosterSyncService.runRosterSync.mockResolvedValue(result);
      const res = createResponse();

      await importNow({ body: { payPeriodId } }, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(424);
      expect(res.json).toHaveBeenCalledWith(result);
    });

    test("returns the simulated sheet failure and previous draft", async () => {
      const previousDraft = { success: true, payPeriodId, staffSynced: 1 };
      rosterSyncService.getLastSyncResult.mockResolvedValue(previousDraft);
      const res = createResponse();

      await importNow({ body: { payPeriodId, simulateFailure: true } }, res, jest.fn());

      expect(rosterSyncService.getLastSyncResult).toHaveBeenCalledWith(payPeriodId);
      expect(rosterSyncService.runRosterSync).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(424);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "ROSTER_SOURCE_UNREACHABLE",
        message: "Simulated failure for demo purposes; previous draft retained",
        previousDraft,
      });
    });

    test("passes unexpected errors to next", async () => {
      const error = new Error("Sync failed");
      rosterSyncService.runRosterSync.mockRejectedValue(error);
      const res = createResponse();
      const next = jest.fn();

      await importNow({ body: { payPeriodId } }, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getSyncSummary", () => {
    test("returns the latest sync summary", async () => {
      const summary = { success: true, payPeriodId, staffSynced: 2 };
      rosterSyncService.getLastSyncResult.mockResolvedValue(summary);
      const res = createResponse();
      const next = jest.fn();

      await getSyncSummary({ query: { payPeriodId } }, res, next);

      expect(rosterSyncService.getLastSyncResult).toHaveBeenCalledWith(payPeriodId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(summary);
      expect(next).not.toHaveBeenCalled();
    });

    test("passes summary errors to next", async () => {
      const error = new Error("Summary failed");
      rosterSyncService.getLastSyncResult.mockRejectedValue(error);
      const next = jest.fn();

      await getSyncSummary({ query: { payPeriodId } }, createResponse(), next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getSyncHistory", () => {
    test("returns sync history for the requested pay period", async () => {
      const history = [{ action: "roster_synced", actor: "manual" }];
      rosterSyncService.getSyncHistory.mockResolvedValue(history);
      const res = createResponse();
      const next = jest.fn();

      await getSyncHistory({ query: { payPeriodId } }, res, next);

      expect(rosterSyncService.getSyncHistory).toHaveBeenCalledWith(payPeriodId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ history });
      expect(next).not.toHaveBeenCalled();
    });

    test("passes history errors to next", async () => {
      const error = new Error("History failed");
      rosterSyncService.getSyncHistory.mockRejectedValue(error);
      const next = jest.fn();

      await getSyncHistory({ query: { payPeriodId } }, createResponse(), next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
