// Combines all route files into one router that app.js can mount.
// Only the roster routes exist so far (UC-001) — teammates will add their
// own routes here for their use cases (timesheets, payroll, approvals, payments).

const express = require("express");
const router = express.Router();

router.use("/roster", require("./roster"));
router.use("/timesheets", require("./timesheets"));
router.use("/payroll", require("./payroll"));
router.use("/approvals", require("./approvals"));
router.use("/payments", require("./payments"));
router.use("/staff", require("./staff"));
router.use("/pay-periods", require("./payPeriods"));

router.use('/payroll', require("./payrollRoutes")); // UC-003
router.use('/user', require("./userRoutes")); // auth

module.exports = router;