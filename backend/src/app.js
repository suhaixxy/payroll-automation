// Sets up the Express application: middleware + routes.
// server.js is what actually starts it listening on a port.

const express = require("express");
const cors = require("cors");
const routes = require("./routes/index");
const requestLogger = require("./middleware/requestLogger");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Friendly landing response so opening http://localhost:5000 in a browser
// doesn't show "Cannot GET /" — the real endpoints live under /api.

const { pool } = require("./config/database");

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", database: "disconnected", message: err.message });
  }
});

app.get('/', (req, res) => {
  res.json({
    name: 'Payroll Automation API',
    endpoints: ['/api/pay-periods', '/api/roster', '/api/payroll', '/api/user'],
  });
});

app.use("/api", routes);

app.use(errorHandler);

module.exports = app;