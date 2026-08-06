const express = require("express");
const router = express.Router();

router.use("/roster", require("./roster"));
router.use("/timesheets", require("./timesheets"));
router.use("/payroll", require("./payroll"));
router.use("/approvals", require("./approvals"));
router.use("/payments", require("./payments"));
router.use("/staff", require("./staff"));
router.use("/pay-periods", require("./payPeriods"));

// UC-005
router.use("/auth", require("./auth"));
router.use("/audit-logs", require("./auditLogs"));
router.use("/payslips", require("./payslips"));

module.exports = router;