// Combines all route files into one router that app.js can mount.
// Only the roster routes exist so far (UC-001) — teammates will add their
// own routes here for their use cases (timesheets, payroll, approvals, payments).

const express = require("express");
const router = express.Router();

router.use("/roster", require("./roster"));
router.use("/timesheets", require("./timesheets"));
router.use("/uc003", require("./uc003")); // UC-003 payroll calculation (guide §6)
router.use("/approvals", require("./approvals"));
router.use("/payments", require("./payments"));
router.use("/staff", require("./staff"));
router.use("/pay-periods", require("./payPeriods"));

// UC-005
router.use("/auth", require("./auth"));
router.use("/audit-logs", require("./auditLogs"));
router.use("/payslips", require("./payslips"));

module.exports = router;