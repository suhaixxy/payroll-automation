// Runs the UC-001 roster import once per day at midnight without adding a
// cron dependency. The slot set prevents repeated imports during midnight.
const rosterSyncService = require("../services/rosterSyncService");

const CHECK_INTERVAL_MS = 60 * 1000;
const completedDates = new Set();

function runIfDue(now = new Date()) {
  if (now.getHours() !== 0 || now.getMinutes() !== 0) return;

  const dateKey = now.toISOString().slice(0, 10);
  if (completedDates.has(dateKey)) return;

  completedDates.add(dateKey);
  rosterSyncService.runRosterSync(undefined, "scheduler").catch((error) => {
    console.error("[rosterSyncScheduler] Scheduled sync failed:", error.message);
  });
}

function start() {
  setInterval(() => runIfDue(), CHECK_INTERVAL_MS);
}

module.exports = { start, runIfDue };
