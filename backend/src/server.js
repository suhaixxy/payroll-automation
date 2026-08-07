// .env lives at the payroll-automation project root, one level above
// backend/ — must load before anything below reads process.env.
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const app = require("./app");
const rosterSyncScheduler = require("./jobs/rosterSyncScheduler");
const payPeriodService = require("./services/payPeriodService");
const { initializeDatabase } = require("./db/initializeDatabase");
const { waitForDatabase } = require("./db/waitForDb");
const { sequelize, syncUc003Tables } = require("./models");

const PORT = process.env.PORT || 5000;

async function start() {
  // The compose file has no healthcheck, so right after `npm run db:up` the
  // container is "running" before Postgres accepts connections — poll first.
  await waitForDatabase({ log: (message) => console.log(`[server] ${message}`) });

  // Apply any pending SQL migrations, then let Sequelize create the
  // UC-003-owned tables (plain sync — never force/alter, so it can only
  // add missing tables, never touch existing ones).
  await initializeDatabase();
  await syncUc003Tables();

  // Also doubles as a startup DB connectivity check — if Postgres isn't
  // running, this fails loudly here instead of on the first API request.
  const result = await payPeriodService.ensurePayPeriodsSeeded();
  console.log(`[startup] ${result.message}`);

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  rosterSyncScheduler.start();
}

start().catch((err) => {
  console.error(`[server] Failed to start: ${err.message}`);
  console.error("[server] Is Docker Desktop running? Try: npm run db:up");
  process.exit(1);
});
