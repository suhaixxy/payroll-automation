// UC-003: HTTP layer for payroll calculation. Orchestration only — all
// business logic lives in services/payrollCalcEngine.js.

const yup = require('yup');
const payrollCalcEngine = require('../services/payrollCalcEngine');

const calculateSchema = yup.object({
  payPeriodId: yup.string().uuid().required(),
});

// POST /api/payroll/calculate — body { payPeriodId }
async function calculate(req, res, next) {
  try {
    let body;
    try {
      body = await calculateSchema.validate(req.body, { stripUnknown: true });
    } catch (validationErr) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: validationErr.errors.join('; ') });
    }

    // req.user is set by validateToken — recorded as the audit actor.
    const result = await payrollCalcEngine.calculatePayroll(body.payPeriodId, req.user.email);

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({
        error: 'PAY_PERIOD_NOT_FOUND',
        message: `No pay period with id ${body.payPeriodId}`,
      });
    }
    if (result.error === 'NOT_VALIDATED') {
      return res.status(409).json({
        error: 'PAY_PERIOD_NOT_VALIDATED',
        message: `Pay period is '${result.currentStatus}', not 'validated' — nothing was calculated.`,
      });
    }

    res.status(200).json(result.data);
  } catch (err) {
    next(err);
  }
}

// GET /api/payroll/:payPeriodId
async function getPayroll(req, res, next) {
  try {
    // A non-UUID id can't be any period — treat it as not found rather than
    // letting Postgres throw a cast error into the 500 handler.
    const isUuid = await yup.string().uuid().isValid(req.params.payPeriodId);
    if (!isUuid) {
      return res.status(404).json({ error: 'PAY_PERIOD_NOT_FOUND', message: 'Invalid pay period id.' });
    }

    const result = await payrollCalcEngine.getPayrollForPeriod(req.params.payPeriodId);

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({
        error: 'PAY_PERIOD_NOT_FOUND',
        message: `No pay period with id ${req.params.payPeriodId}`,
      });
    }
    if (result.error === 'NO_LINES') {
      return res.status(404).json({
        error: 'NO_PAYROLL_LINES',
        message: 'This period has no payroll lines yet — run the calculation first.',
      });
    }

    res.status(200).json(result.data);
  } catch (err) {
    next(err);
  }
}

// GET /api/payroll/periods/list — pay periods with status, so the frontend
// can mark which ones are 'validated' and ready to calculate.
async function listPeriods(req, res, next) {
  try {
    const payPeriods = await payrollCalcEngine.listPeriodsWithStatus();
    res.status(200).json({ payPeriods });
  } catch (err) {
    next(err);
  }
}

module.exports = { calculate, getPayroll, listPeriods };