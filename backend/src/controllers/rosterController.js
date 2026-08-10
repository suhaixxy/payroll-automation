// UC-001: Handles the HTTP requests for roster sync and passes the work
// along to rosterSyncService, then sends back a JSON response.

const rosterSyncService = require("../services/rosterSyncService");
const { pool } = require("../config/database");
const { fetchRosterRows } = require("../adapters/googleSheetsAdapter");

// POST /api/roster/sync — "Import Now" button
async function importNow(req, res, next) {
  try {
    const { payPeriodId, simulateFailure } = req.body;

    if (simulateFailure) {
      // Demo-only path: lets accounting staff show alt flow 1b (sheet
      // unreachable) live without actually editing .env mid-demo.
      const previousDraft = await rosterSyncService.getLastSyncResult(payPeriodId);
      return res.status(424).json({
        success: false,
        error: "ROSTER_SOURCE_UNREACHABLE",
        message: "Simulated failure for demo purposes; previous draft retained",
        previousDraft,
      });
    }

    const result = await rosterSyncService.runRosterSync(payPeriodId, "manual");

    if (!result.success) {
      // 424 = "the thing we depend on (the Google Sheet) failed"
      return res.status(424).json(result);
    }

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// GET /api/roster/sync/summary — shows the latest sync result on page load
async function getSyncSummary(req, res, next) {
  try {
    const result = await rosterSyncService.getLastSyncResult(req.query.payPeriodId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// GET /api/roster/sync/history — recent sync events (manual + scheduled) for this period
async function getSyncHistory(req, res, next) {
  try {
    const history = await rosterSyncService.getSyncHistory(req.query.payPeriodId);
    res.status(200).json({ history });
  } catch (err) {
    next(err);
  }
}

// GET /api/roster/health — reports dependency reachability without making
// either dependency's failure an HTTP failure.
async function getSourceHealth(req, res) {
  const [database, googleSheet] = await Promise.all([
    pool.query("SELECT 1")
      .then(() => "connected")
      .catch(() => "disconnected"),
    fetchRosterRows()
      .then(() => "connected")
      .catch(() => "disconnected"),
  ]);

  res.status(200).json({ database, googleSheet });
}

async function resolveException(req, res, next) {
  try {
    const result = await rosterSyncService.resolveException(req.params.timesheetRowId, req.body);
    if (!result.success) {
      const status = result.error === "TIMESHEET_ROW_NOT_FOUND" ? 404 : result.error === "TIMESHEET_ROW_FROZEN" ? 409 : 400;
      return res.status(status).json(result);
    }
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function getResolvedExceptions(req, res, next) {
  try {
    const resolvedExceptions = await rosterSyncService.getResolvedExceptions(req.query.payPeriodId);
    res.status(200).json({ resolvedExceptions });
  } catch (err) {
    next(err);
  }
}

async function undoException(req, res, next) {
  try {
    const result = await rosterSyncService.undoException(req.params.timesheetRowId);
    if (!result.success) {
      const status = result.error === "TIMESHEET_ROW_NOT_FOUND" ? 404 : result.error === "TIMESHEET_ROW_FROZEN" ? 409 : 400;
      return res.status(status).json(result);
    }
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function resetPeriodResolutions(req, res, next) {
  try {
    const result = await rosterSyncService.resetPeriodResolutions(req.body.payPeriodId);
    if (!result.success) return res.status(424).json(result);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { importNow, getSyncSummary, getSyncHistory, getSourceHealth, resolveException, getResolvedExceptions, undoException, resetPeriodResolutions };
