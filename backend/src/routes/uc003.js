// UC-003 contains organisation-wide payroll information and manager actions.
// The entire router is manager-only; employee self-service remains in UC-005.

const express = require('express');
const uc003Controller = require('../controllers/uc003Controller');
const adjustmentController = require('../controllers/adjustmentController');
const performanceInputController = require('../controllers/performanceInputController');
const rateSetController = require('../controllers/rateSetController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();
router.use(authenticate, authorize('manager'));

router.get('/periods', uc003Controller.listPeriods);
router.get('/staff', uc003Controller.listStaff);

router.post(
  '/periods/:periodId/calculate',
  uc003Controller.calculate
);
router.post(
  '/periods/:periodId/recalculate',
  uc003Controller.recalculate
);
router.post(
  '/periods/:periodId/submit-approval',
  uc003Controller.submitApproval
);

router.get('/periods/:periodId/summary', uc003Controller.summary);
router.get('/periods/:periodId/lines', uc003Controller.lines);
router.get('/periods/:periodId/runs', uc003Controller.runs);
router.get('/periods/:periodId/variance', uc003Controller.staffVariance);
router.get('/periods/:periodId/export.csv', uc003Controller.exportCsv);
router.get('/lines/:lineId', uc003Controller.line);

// Payroll line CRUD — manual overrides on the latest run (§5.10).
// Manager only; blocked once the period is approved or paid.
router.post('/periods/:periodId/lines', uc003Controller.createLine);
router.patch('/lines/:lineId', uc003Controller.updateLine);
router.delete('/lines/:lineId', uc003Controller.deleteLine);
router.post('/lines/:lineId/resolve', uc003Controller.resolveLine);

// Edit history — recent edits across all entities, and per-entity trail.
router.get('/edit-log/recent', uc003Controller.recentEdits);
router.get('/edit-log/:entityType/:entityId', uc003Controller.editHistory);

router.post('/runs/:runId/void', uc003Controller.voidRun);

// Payroll adjustments — manager-only full CRUD; soft delete; 409 once approved/paid.
router.get('/adjustments', adjustmentController.list);
router.get('/adjustments/:id', adjustmentController.detail);
router.post('/adjustments', adjustmentController.create);
router.patch('/adjustments/:id', adjustmentController.patch);
router.delete('/adjustments/:id', adjustmentController.remove);

// Performance inputs — manager-only full CRUD; soft delete; 409 once approved/paid.
router.get('/performance-inputs', performanceInputController.list);
router.get('/performance-inputs/:id', performanceInputController.detail);
router.post(
  '/performance-inputs',
  performanceInputController.create
);
router.patch(
  '/performance-inputs/:id',
  performanceInputController.patch
);
router.delete(
  '/performance-inputs/:id',
  performanceInputController.remove
);

// Statutory rate sets (§6). Manager-only. POST creates a NEW VERSION and
// closes the current one — no update or
// delete: a rate set is superseded, never edited.
router.get('/rate-sets', rateSetController.list);
router.get('/rate-sets/:id', rateSetController.detail);
router.post('/rate-sets', rateSetController.create);

module.exports = router;
