const validationService = require("../services/validationService");

const context = (req) => ({ user: req.user, ipAddress: req.ip });

exports.listPeriods = async (req, res, next) => {
  try {
    res.json(await validationService.listPeriods());
  } catch (error) {
    next(error);
  }
};

exports.review = async (req, res, next) => {
  try {
    res.json(await validationService.getReview(req.params.payPeriodId));
  } catch (error) {
    next(error);
  }
};

exports.runValidation = async (req, res, next) => {
  try {
    const result = await validationService.runValidation(req.params.payPeriodId, context(req));
    res.json({ message: "Timesheet validation completed.", data: result });
  } catch (error) {
    next(error);
  }
};

exports.resolveException = async (req, res, next) => {
  try {
    const result = await validationService.resolveException(req.params.exceptionId, req.body, context(req));
    res.json({ message: "Timesheet exception updated.", data: result });
  } catch (error) {
    next(error);
  }
};

exports.bulkResolve = async (req, res, next) => {
  try {
    const result = await validationService.bulkResolveExceptions(req.params.payPeriodId, req.body, context(req));
    res.json({ message: `${result.resolvedCount} exception(s) confirmed.`, data: result });
  } catch (error) {
    next(error);
  }
};

exports.completeValidation = async (req, res, next) => {
  try {
    const result = await validationService.markValidated(req.params.payPeriodId, context(req));
    res.json({ message: "Pay period validated and timesheets frozen.", data: result });
  } catch (error) {
    next(error);
  }
};

exports.auditLog = async (req, res, next) => {
  try {
    res.json(await validationService.getAuditLog(req.params.payPeriodId));
  } catch (error) {
    next(error);
  }
};
