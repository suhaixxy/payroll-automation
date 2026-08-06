// UC-003 routes (guide §6). RBAC lives HERE, on the routes, never in the
// frontend (§2.2):
//   reads                        — any authenticated user
//   calculate / recalculate     — manager or accounting
//   submit-approval / void run  — manager only

const express = require('express');
const uc003Controller = require('../controllers/uc003Controller');
const adjustmentController = require('../controllers/adjustmentController');
const performanceInputController = require('../controllers/performanceInputController');
const rateSetController = require('../controllers/rateSetController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/periods', requireAuth, uc003Controller.listPeriods);
router.get('/staff', requireAuth, uc003Controller.listStaff);

router.post(
  '/periods/:periodId/calculate',
  requireAuth,
  requireRole('manager', 'accounting'),
  uc003Controller.calculate
);
router.post(
  '/periods/:periodId/recalculate',
  requireAuth,
  requireRole('manager', 'accounting'),
  uc003Controller.recalculate
);
router.post(
  '/periods/:periodId/submit-approval',
  requireAuth,
  requireRole('manager'),
  uc003Controller.submitApproval
);

router.get('/periods/:periodId/summary', requireAuth, uc003Controller.summary);
router.get('/periods/:periodId/lines', requireAuth, uc003Controller.lines);
router.get('/periods/:periodId/runs', requireAuth, uc003Controller.runs);
router.get('/lines/:lineId', requireAuth, uc003Controller.line);

router.post('/runs/:runId/void', requireAuth, requireRole('manager'), uc003Controller.voidRun);

// Payroll adjustments — full CRUD (§6). Reads: any authenticated user.
// Create / update / delete: manager ONLY; soft delete; 409 once approved/paid.
router.get('/adjustments', requireAuth, adjustmentController.list);
router.get('/adjustments/:id', requireAuth, adjustmentController.detail);
router.post('/adjustments', requireAuth, requireRole('manager'), adjustmentController.create);
router.patch('/adjustments/:id', requireAuth, requireRole('manager'), adjustmentController.patch);
router.delete('/adjustments/:id', requireAuth, requireRole('manager'), adjustmentController.remove);

// Performance inputs — full CRUD (§6). Reads: any authenticated user.
// Create / update / delete: manager ONLY; soft delete; 409 once approved/paid.
router.get('/performance-inputs', requireAuth, performanceInputController.list);
router.get('/performance-inputs/:id', requireAuth, performanceInputController.detail);
router.post(
  '/performance-inputs',
  requireAuth,
  requireRole('manager'),
  performanceInputController.create
);
router.patch(
  '/performance-inputs/:id',
  requireAuth,
  requireRole('manager'),
  performanceInputController.patch
);
router.delete(
  '/performance-inputs/:id',
  requireAuth,
  requireRole('manager'),
  performanceInputController.remove
);

// Statutory rate sets (§6). Reads: any authenticated user. POST creates a
// NEW VERSION (manager only) and closes the current one — no update or
// delete: a rate set is superseded, never edited.
router.get('/rate-sets', requireAuth, rateSetController.list);
router.get('/rate-sets/:id', requireAuth, rateSetController.detail);
router.post('/rate-sets', requireAuth, requireRole('manager'), rateSetController.create);

module.exports = router;
