const express = require("express");
const router = express.Router();

router.use("/roster", require("./roster"));
router.use("/timesheets", require("./timesheets"));
router.use("/payroll", require("./payroll"));
router.use("/approvals", require("./approvals"));
router.use("/payments", require("./payments"));
router.use("/staff", require("./staff"));
router.use("/pay-periods", require("./payPeriods"));

module.exports = router;