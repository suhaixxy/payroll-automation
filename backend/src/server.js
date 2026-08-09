// Load the repository-root environment before modules read process.env.
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const app = require("./app");
const rosterSyncScheduler = require("./jobs/rosterSyncScheduler");
const payPeriodService = require("./services/payPeriodService");
const { initializeDatabase } = require("./db/initializeDatabase");
const { waitForDatabase } = require("./db/waitForDb");
const PORT = process.env.PORT || 5000;

function isPayPeriodGenerationEnabled(env = process.env) {
  return env.GENERATE_PAY_PERIODS_ON_STARTUP === "true";
}

async function start({
  waitForDb = waitForDatabase,
  migrate = initializeDatabase,
  generatePayPeriods = payPeriodService.ensurePayPeriodsSeeded,
  listen = (port, callback) => app.listen(port, callback),
  startScheduler = () => rosterSyncScheduler.start(),
  env = process.env,
  log = console.log,
} = {}) {
  // Docker can report the container as running before PostgreSQL accepts
  // connections, so readiness must succeed before migrations or listening.
  await waitForDb({ log: (message) => log(`[server] ${message}`) });
  log("PostgreSQL Connected");

  // All application tables are migration-owned; no Sequelize sync is used.
  await migrate();

  // Demo/bootstrap generation is separate from readiness and migrations.
  if (isPayPeriodGenerationEnabled(env)) {
    log("[startup] Pay-period generation explicitly enabled");
    const result = await generatePayPeriods();
    log(`[startup] ${result.message}`);
  } else {
    log("[startup] Pay-period generation skipped (set GENERATE_PAY_PERIODS_ON_STARTUP=true to enable)");
  }

  const server = listen(env.PORT || PORT, () => {
    log(`Server running on port ${env.PORT || PORT}`);
  });

  startScheduler();
  return server;
}

if (require.main === module) {
  start().catch((err) => {
    console.error(`[server] Failed to start: ${err.message}`);
    console.error("[server] Is Docker Desktop running? Try: npm run db:up");
    process.exit(1);
  });
}

module.exports = { start, isPayPeriodGenerationEnabled };
