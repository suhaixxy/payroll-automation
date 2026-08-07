// Sets up the Express application: middleware + routes.
// server.js is what actually starts it listening on a port.

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const routes = require("./routes/index");
const requestLogger = require("./middleware/requestLogger");
const errorHandler = require("./middleware/errorHandler");
const apiResponse = require("./middleware/apiResponse");
const { pool } = require("./config/database");

const app = express();

// ==========================================================
// Shared security and request middleware
// ==========================================================

app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  })
);

app.use(express.json());

app.use(
  express.urlencoded({
    extended: false,
  })
);

app.use(requestLogger);
app.use(apiResponse);

// Friendly landing response so opening http://localhost:5000 in a browser
// doesn't show "Cannot GET /" — the real endpoints live under /api.

// ==========================================================
// Health checks
// ==========================================================

// Preserve the group's database-aware health check
const healthCheck = async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      status: "ok",
      database: "connected",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      database: "disconnected",
      message: err.message,
    });
  }
};

app.get("/health", healthCheck);

// Keep compatibility with your UC-005 API health URL as well
app.get("/api/health", healthCheck);

// ==========================================================
// API routes
// ==========================================================

app.get('/', (req, res) => {
  res.json({
    name: 'Payroll Automation API',
    endpoints: ['/api/pay-periods', '/api/roster', '/api/payroll', '/api/user'],
  });
});

app.use("/api", routes);

// ==========================================================
// Root route
// ==========================================================

app.get("/", (req, res) => {
  res.json({
    message: "Payroll Automation API is running.",
  });
});

// ==========================================================
// Global error handler
// ==========================================================

app.use(errorHandler);

module.exports = app;