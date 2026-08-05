const approvalService = require("../services/approvalService");

async function listPayPeriods(req, res, next) {
  try {
    res.json(await approvalService.listPayPeriods());
  } catch (error) {
    next(error);
  }
}

async function getSummary(req, res, next) {
  try {
    if (!req.query.payPeriodId) {
      return res.status(400).json({ message: "payPeriodId is required." });
    }
    const summary = await approvalService.getSummary(req.query.payPeriodId);
    if (!summary) return res.status(404).json({ message: "Pay period not found." });
    res.json({ ...summary, previousCycle: { totalNet: summary.previousTotalNet || null } });
  } catch (error) {
    next(error);
  }
}

async function getLineDetail(req, res, next) {
  try {
    const line = await approvalService.getLineDetail(req.params.lineId);
    if (!line) return res.status(404).json({ message: "Payroll line not found." });
    res.json(line);
  } catch (error) {
    next(error);
  }
}

async function submitDecision(req, res, next) {
  try {
    const result = await approvalService.submitDecision(req.body);
    const statuses = {
      VALIDATION_ERROR: 400,
      COMMENT_REQUIRED: 422,
      NOT_FOUND: 404,
      INVALID_STATUS: 409,
      INCOMPLETE_LINES: 409,
    };
    if (statuses[result.error]) return res.status(statuses[result.error]).json(result);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = { listPayPeriods, getSummary, getLineDetail, submitDecision };
