// Shared: routes for pay periods (used by all UCs).

const express = require("express");
const payPeriodController = require("../controllers/payPeriodController");

const router = express.Router();

router.get("/", payPeriodController.listPayPeriods);
router.get("/:id", payPeriodController.getPayPeriod);

module.exports = router;