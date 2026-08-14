// UC-003 routes (guide §6). RBAC lives HERE, on the routes, never in the
// frontend (§2.2):
//   reads                        — any authenticated user
//   calculate / recalculate     — manager only
//   submit-approval / void run  — manager only
//
// Uses the same `authenticate` + `authorize` middleware as every other
// feature (UC-004 approvals, UC-005 payments). This file previously used a
// separate, orphaned `middleware/auth.js` left over from an older auth
// model whose roles were 'accounting'/'manager' — the real `user_account`
// table only ever has 'manager' or 'employee' (see
// db/migrations/005_uc005_payment_extension.sql), so `requireRole('manager',
// 'accounting')` was effectively `requireRole('manager')` but with a
// confusing error message naming a role nobody can ever have.

const express = require('express');
const uc003Controller = require('../controllers/uc003Controller');
const adjustmentController = require('../controllers/adjustmentController');
const performanceInputController = require('../controllers/performanceInputController');
const rateSetController = require('../controllers/rateSetController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.get('/periods', authenticate, uc003Controller.listPeriods);
router.get('/staff', authenticate, uc003Controller.listStaff);

router.post(
  '/periods/:periodId/calculate',
  authenticate,
  authorize('manager'),
  uc003Controller.calculate
);
router.post(
  '/periods/:periodId/recalculate',
  authenticate,
  authorize('manager'),
  uc003Controller.recalculate
);
router.post(
  '/periods/:periodId/submit-approval',
  authenticate,
  authorize('manager'),
  uc003Controller.submitApproval
);

router.get('/periods/:periodId/summary', authenticate, uc003Controller.summary);
router.get('/periods/:periodId/lines', authenticate, uc003Controller.lines);
router.get('/periods/:periodId/runs', authenticate, uc003Controller.runs);
router.get('/periods/:periodId/variance', authenticate, uc003Controller.staffVariance);
router.get('/periods/:periodId/export.csv', authenticate, uc003Controller.exportCsv);
router.get('/lines/:lineId', authenticate, uc003Controller.line);

// Payroll line CRUD — manual overrides on the latest run (§5.10).
// Manager only; blocked once the period is approved or paid.
router.post('/periods/:periodId/lines', requireAuth, requireRole('manager'), uc003Controller.createLine);
router.patch('/lines/:lineId', requireAuth, requireRole('manager'), uc003Controller.updateLine);
router.delete('/lines/:lineId', requireAuth, requireRole('manager'), uc003Controller.deleteLine);
router.post('/lines/:lineId/resolve', requireAuth, requireRole('manager'), uc003Controller.resolveLine);
router.post('/periods/:periodId/lines', authenticate, authorize('manager'), uc003Controller.createLine);
router.patch('/lines/:lineId', authenticate, authorize('manager'), uc003Controller.updateLine);
router.delete('/lines/:lineId', authenticate, authorize('manager'), uc003Controller.deleteLine);

// Edit history — recent edits across all entities, and per-entity trail.
router.get('/edit-log/recent', authenticate, uc003Controller.recentEdits);
router.get('/edit-log/:entityType/:entityId', authenticate, uc003Controller.editHistory);

router.post('/runs/:runId/void', authenticate, authorize('manager'), uc003Controller.voidRun);

// Payroll adjustments — full CRUD (§6). Reads: any authenticated user.
// Create / update / delete: manager ONLY; soft delete; 409 once approved/paid.
router.get('/adjustments', authenticate, adjustmentController.list);
router.get('/adjustments/:id', authenticate, adjustmentController.detail);
router.post('/adjustments', authenticate, authorize('manager'), adjustmentController.create);
router.patch('/adjustments/:id', authenticate, authorize('manager'), adjustmentController.patch);
router.delete('/adjustments/:id', authenticate, authorize('manager'), adjustmentController.remove);

// Performance inputs — full CRUD (§6). Reads: any authenticated user.
// Create / update / delete: manager ONLY; soft delete; 409 once approved/paid.
router.get('/performance-inputs', authenticate, performanceInputController.list);
router.get('/performance-inputs/:id', authenticate, performanceInputController.detail);
router.post(
  '/performance-inputs',
  authenticate,
  authorize('manager'),
  performanceInputController.create
);
router.patch(
  '/performance-inputs/:id',
  authenticate,
  authorize('manager'),
  performanceInputController.patch
);
router.delete(
  '/performance-inputs/:id',
  authenticate,
  authorize('manager'),
  performanceInputController.remove
);

// Statutory rate sets (§6). Reads: any authenticated user. POST creates a
// NEW VERSION (manager only) and closes the current one — no update or
// delete: a rate set is superseded, never edited.
router.get('/rate-sets', authenticate, rateSetController.list);
router.get('/rate-sets/:id', authenticate, rateSetController.detail);
router.post('/rate-sets', authenticate, authorize('manager'), rateSetController.create);

module.exports = router;
