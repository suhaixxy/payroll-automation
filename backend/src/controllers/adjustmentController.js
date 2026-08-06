// UC-003 phase 4: HTTP layer for payroll adjustments. Server-side yup
// validation on every write (§2.6) — the frontend's checks are convenience,
// never authority. RBAC (manager-only mutations) is enforced on the routes.

const yup = require('yup');
const adjustmentService = require('../services/adjustmentService');

const ADJUSTMENT_TYPES = ['bonus', 'allowance', 'deduction', 'clawback', 'correction'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Money rule (§2.6): numeric, at most 2 decimals, inside a sane bound.
// Adjustments MAY be negative (deduction/clawback). TODO(verify) the bound
// with the team — $100,000 per adjustment for now.
const amountSchema = yup
  .number()
  .typeError('amount must be a number')
  .test('two-decimals', 'amount may have at most 2 decimal places', (value) =>
    value === undefined ? true : Math.abs(value * 100 - Math.round(value * 100)) < 1e-6
  )
  .min(-100000, 'amount is out of bounds')
  .max(100000, 'amount is out of bounds');

const createSchema = yup.object({
  staffId: yup.string().matches(UUID_PATTERN, 'staffId must be a UUID').required(),
  periodId: yup.string().matches(UUID_PATTERN, 'periodId must be a UUID').required(),
  adjustmentType: yup.string().oneOf(ADJUSTMENT_TYPES).required(),
  amount: amountSchema.required(),
  cpfApplicable: yup.boolean().default(true),
  reason: yup.string().trim().min(3, 'reason is required (min 3 characters)').max(500).required(),
});

const patchSchema = yup.object({
  adjustmentType: yup.string().oneOf(ADJUSTMENT_TYPES),
  amount: amountSchema,
  cpfApplicable: yup.boolean(),
  reason: yup.string().trim().min(3).max(500),
});

function failFromServiceError(res, result) {
  switch (result.error) {
    case 'ADJUSTMENT_NOT_FOUND':
      return res.fail(404, 'ADJUSTMENT_NOT_FOUND', 'No adjustment with that id.');
    case 'STAFF_NOT_FOUND':
      return res.fail(400, 'VALIDATION_ERROR', 'Referenced staff member does not exist.', [
        { field: 'staffId', message: 'unknown staff id' },
      ]);
    case 'PERIOD_NOT_FOUND':
      return res.fail(400, 'VALIDATION_ERROR', 'Referenced pay period does not exist.', [
        { field: 'periodId', message: 'unknown period id' },
      ]);
    case 'PERIOD_LOCKED':
      return res.fail(
        409,
        'PERIOD_LOCKED',
        `Pay period is '${result.currentStatus}' — adjustments can no longer be changed.`
      );
    default:
      return res.fail(500, 'INTERNAL_ERROR', 'Unexpected adjustment error.');
  }
}

async function validateBody(schema, req, res) {
  try {
    return await schema.validate(req.body, { stripUnknown: true, abortEarly: false });
  } catch (validationErr) {
    res.fail(
      400,
      'VALIDATION_ERROR',
      validationErr.errors.join('; '),
      validationErr.inner.map((issue) => ({ field: issue.path, message: issue.message }))
    );
    return null;
  }
}

function checkUuid(res, value) {
  if (UUID_PATTERN.test(value)) return true;
  res.fail(404, 'ADJUSTMENT_NOT_FOUND', 'Invalid adjustment id.');
  return false;
}

const actorOf = (req) => ({ id: req.user.id, role: req.user.role });

async function list(req, res, next) {
  try {
    const { periodId, staffId } = req.query;
    for (const value of [periodId, staffId]) {
      if (value && !UUID_PATTERN.test(value)) {
        return res.fail(400, 'VALIDATION_ERROR', 'periodId and staffId filters must be UUIDs.');
      }
    }
    const result = await adjustmentService.list({ periodId, staffId });
    res.ok(result.data);
  } catch (err) {
    next(err);
  }
}

async function detail(req, res, next) {
  try {
    if (!checkUuid(res, req.params.id)) return;
    const result = await adjustmentService.getById(req.params.id);
    if (result.error) return failFromServiceError(res, result);
    res.ok(result.data);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const body = await validateBody(createSchema, req, res);
    if (!body) return;
    const result = await adjustmentService.create(body, actorOf(req));
    if (result.error) return failFromServiceError(res, result);
    res.created(result.data);
  } catch (err) {
    next(err);
  }
}

async function patch(req, res, next) {
  try {
    if (!checkUuid(res, req.params.id)) return;
    const body = await validateBody(patchSchema, req, res);
    if (!body) return;
    if (Object.keys(body).length === 0) {
      return res.fail(400, 'VALIDATION_ERROR', 'Provide at least one field to update.');
    }
    const result = await adjustmentService.update(req.params.id, body, actorOf(req));
    if (result.error) return failFromServiceError(res, result);
    res.ok(result.data);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    if (!checkUuid(res, req.params.id)) return;
    const result = await adjustmentService.softDelete(req.params.id, actorOf(req));
    if (result.error) return failFromServiceError(res, result);
    res.noContent();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, detail, create, patch, remove, ADJUSTMENT_TYPES };
