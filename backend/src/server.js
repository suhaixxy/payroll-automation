require("dotenv").config();

const app = require("./app");
const { connectDB } = require("./config/database");
const payPeriodService = require("./services/payPeriodService");
const scheduler = require("./jobs/rosterSyncScheduler");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Verify PostgreSQL connection before starting the API.
    await connectDB();

    app.listen(PORT, async () => {
      console.log(`Server running on port ${PORT}`);

      // UC-001 roster synchronisation scheduler.
      scheduler.start();

      // Ensure required payroll periods exist.
      try {
        const result = await payPeriodService.ensurePayPeriodsSeeded();
        console.log(`[startup] ${result.message}`);
      } catch (error) {
        console.error(
          "[startup] Failed to ensure pay periods are seeded:",
          error.message
        );
      }
    });
  } catch (error) {
    console.error("Server startup failed.", error);
    process.exitCode = 1;
  }
};

startServer();