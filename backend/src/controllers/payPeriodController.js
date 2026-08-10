// Shared: handles HTTP requests for pay periods (used by all UCs).

const payPeriodService = require("../services/payPeriodService");

// GET /api/pay-periods — list all pay periods, with isActive flag
async function listPayPeriods(req, res, next) {
  try {
    const periods = await payPeriodService.listPayPeriods();
    res.status(200).json(periods);
  } catch (err) {
    next(err);
  }
}

// GET /api/pay-periods/:id — get a single pay period
async function getPayPeriod(req, res, next) {
  try {
    const period = await payPeriodService.getPayPeriod(req.params.id);
    if (!period) {
      return res.status(404).json({ message: "Pay period not found" });
    }
    res.status(200).json(period);
  } catch (err) {
    next(err);
  }
}

module.exports = { listPayPeriods, getPayPeriod };