// UC-003: payroll calculation routes. Both require a valid login (JWT) —
// calculation is an accounting action, so no extra role gate here (UC-004
// approval is where requireRole('manager') applies).

const express = require('express');
const payrollController = require('../controllers/payrollController');
const { validateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/calculate', validateToken, payrollController.calculate);
// Must be declared before /:payPeriodId or 'periods' would be read as an id.
router.get('/periods/list', validateToken, payrollController.listPeriods);
router.get('/:payPeriodId', validateToken, payrollController.getPayroll);

module.exports = router;
