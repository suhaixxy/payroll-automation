require("dotenv").config();
const app = require("./app");
const payPeriodService = require("./services/payPeriodService");
const scheduler = require("./jobs/rosterSyncScheduler");

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  scheduler.start();
  const result = await payPeriodService.ensurePayPeriodsSeeded();
  console.log(`[startup] ${result.message}`);
});
