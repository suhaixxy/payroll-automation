// UC-003 phase 5: HTTP layer for performance inputs. Server-side yup
// validation on every write (§2.6); RBAC (manager-only mutations) is
// enforced on the routes.

const yup = require('yup');
const performanceInputService = require('../services/performanceInputService');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// §2.6: quantities may not be negative (unlike adjustments); at most 2
// decimals; sane bounds. TODO(verify) the bounds with the team.
const twoDecimals = (value) =>
  value === undefined ? true : Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

const quantitySchema = yup
  .number()
  .typeError('quantity must be a number')
  .min(0, 'quantity may not be negative')
  .max(100000, 'quantity is out of bounds')
  .test('two-decimals', 'quantity may have at most 2 decimal places', twoDecimals);

const unitValueSchema = yup
  .number()
  .typeError('unitValue must be a number')
  .min(0, 'unitValue may not be negative')
  .max(100000, 'unitValue is out of bounds')
  .test('two-decimals', 'unitValue may have at most 2 decimal places', twoDecimals);

const createSchema = yup.object({
  staffId: yup.string().matches(UUID_PATTERN, 'staffId must be a UUID').required(),
  periodId: yup.string().matches(UUID_PATTERN, 'periodId must be a UUID').required(),
  inputType: yup
    .string()
    .trim()
    .lowercase()
    .matches(/^[a-z][a-z0-9_-]{1,39}$/, 'inputType must be a short slug like "sessions"')
    .required(),
  quantity: quantitySchema.required(),
  unitValue: unitValueSchema.required(),
  notes: yup.string().trim().max(500),
});

const patchSchema = yup.object({
  quantity: quantitySchema,
  unitValue: unitValueSchema,
  notes: yup.string().trim().max(500),
});

function failFromServiceError(res, result) {
  switch (result.error) {
    case 'INPUT_NOT_FOUND':
      return res.fail(404, 'INPUT_NOT_FOUND', 'No performance input with that id.');
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
        `Pay period is '${result.currentStatus}' — performance inputs can no longer be changed.`
      );
    case 'DUPLICATE_INPUT':
      return res.fail(
        409,
        'DUPLICATE_INPUT',
        `This staff member already has a '${result.inputType}' input for this period — edit that one instead.`
      );
    default:
      return res.fail(500, 'INTERNAL_ERROR', 'Unexpected performance input error.');
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
  res.fail(404, 'INPUT_NOT_FOUND', 'Invalid performance input id.');
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
    const result = await performanceInputService.list({ periodId, staffId });
    res.ok(result.data);
  } catch (err) {
    next(err);
  }
}

async function detail(req, res, next) {
  try {
    if (!checkUuid(res, req.params.id)) return;
    const result = await performanceInputService.getById(req.params.id);
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
    const result = await performanceInputService.create(body, actorOf(req));
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
    const result = await performanceInputService.update(req.params.id, body, actorOf(req));
    if (result.error) return failFromServiceError(res, result);
    res.ok(result.data);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    if (!checkUuid(res, req.params.id)) return;
    const result = await performanceInputService.softDelete(req.params.id, actorOf(req));
    if (result.error) return failFromServiceError(res, result);
    res.noContent();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, detail, create, patch, remove };
