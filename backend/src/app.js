const express = require("express");
const cors = require("cors");
const routes = require("./routes/index");
const requestLogger = require("./middleware/requestLogger");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);

const { pool } = require("./config/database");

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", database: "disconnected", message: err.message });
  }
});

app.use("/api", routes);

app.use(errorHandler);

module.exports = app;