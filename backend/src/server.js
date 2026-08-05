// .env lives at the payroll-automation project root, one level above
// backend/ — must load before anything below reads process.env.
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const app = require('./app');
const rosterSyncScheduler = require('./jobs/rosterSyncScheduler');
const payPeriodService = require('./services/payPeriodService');
const { initializeDatabase } = require('./db/initializeDatabase');
const { syncUc003Tables } = require('./models');
const { ensureUc003DemoData } = require('./services/uc003SeedService');

const PORT = process.env.PORT || 5000;

async function start() {
  // Apply any pending SQL migrations, then let Sequelize create the
  // UC-003-owned tables (plain sync — never force/alter, so it can only
  // add missing tables, never touch existing ones).
  await initializeDatabase();
  await syncUc003Tables();

  // Also doubles as a startup DB connectivity check — if Postgres isn't
  // running, this fails loudly here instead of on the first API request.
  await payPeriodService.ensurePayPeriodsSeeded();
  await ensureUc003DemoData();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  rosterSyncScheduler.start();
}

start().catch((err) => {
  console.error('[server] Failed to start — is PostgreSQL running? (docker-compose up)', err.message);
  process.exit(1);
});

