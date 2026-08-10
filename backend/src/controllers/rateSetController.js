// UC-003 phase 6: HTTP layer for statutory rate sets. Reads for any
// authenticated user; creating a NEW VERSION is manager-only (routes).
// There is deliberately no PATCH or DELETE — a rate set is superseded by a
// new version, never edited (guide §6), so past runs stay auditable.

const yup = require('yup');
const rateSetService = require('../services/rateSetService');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const fourDecimals = (value) =>
  value === undefined ? true : Math.abs(value * 10000 - Math.round(value * 10000)) < 1e-6;
const twoDecimals = (value) =>
  value === undefined ? true : Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

// Rates are FRACTIONS (0.0025 = 0.25%), multipliers plain factors,
// money in dollars — same units the table stores (§3.2).
const bandSchema = yup.object({
  ageMin: yup.number().integer().min(0).required(),
  ageMax: yup.number().integer().min(0).nullable().default(null),
  employeeRate: yup.number().min(0).max(0.5).test('4dp', 'max 4 decimal places', fourDecimals).required(),
  employerRate: yup.number().min(0).max(0.5).test('4dp', 'max 4 decimal places', fourDecimals).required(),
  minWageThreshold: yup.number().min(0).max(10000).test('2dp', 'max 2 decimal places', twoDecimals).required(),
});

const createSchema = yup.object({
  versionLabel: yup.string().trim().min(2).max(50).required(),
  effectiveFrom: yup.string().matches(DATE_PATTERN, 'effectiveFrom must be YYYY-MM-DD').required(),
  sdlRate: yup.number().moreThan(0).max(0.1).test('4dp', 'max 4 decimal places', fourDecimals).required(),
  sdlMin: yup.number().min(0).max(1000).test('2dp', 'max 2 decimal places', twoDecimals).required(),
  sdlMax: yup.number().min(0).max(10000).test('2dp', 'max 2 decimal places', twoDecimals).required(),
  sdlWageCap: yup.number().moreThan(0).max(100000).test('2dp', 'max 2 decimal places', twoDecimals).required(),
  otMultiplier: yup.number().min(1).max(5).test('4dp', 'max 4 decimal places', fourDecimals).required(),
  phMultiplier: yup.number().min(1).max(5).test('4dp', 'max 4 decimal places', fourDecimals).required(),
  cpfOwCeiling: yup.number().moreThan(0).max(100000).test('2dp', 'max 2 decimal places', twoDecimals).required(),
  bands: yup.array().of(bandSchema).min(1).required(),
});

function failFromServiceError(res, result) {
  switch (result.error) {
    case 'RATE_SET_NOT_FOUND':
      return res.fail(404, 'RATE_SET_NOT_FOUND', 'No rate set with that id.');
    case 'INVALID_BANDS':
      return res.fail(400, 'VALIDATION_ERROR', `CPF bands invalid: ${result.message}.`, [
        { field: 'bands', message: result.message },
      ]);
    case 'EFFECTIVE_FROM_NOT_AFTER_CURRENT':
      return res.fail(
        422,
        'EFFECTIVE_FROM_NOT_AFTER_CURRENT',
        `effectiveFrom must be after the current version's start (${result.currentEffectiveFrom}) — past periods keep the rate set their runs pinned.`
      );
    default:
      return res.fail(500, 'INTERNAL_ERROR', 'Unexpected rate set error.');
  }
}

const actorOf = (req) => ({ id: req.user.id, role: req.user.role });

async function list(req, res, next) {
  try {
    const result = await rateSetService.listRateSets();
    res.ok(result.data);
  } catch (err) {
    next(err);
  }
}

async function detail(req, res, next) {
  try {
    if (!UUID_PATTERN.test(req.params.id)) {
      return res.fail(404, 'RATE_SET_NOT_FOUND', 'Invalid rate set id.');
    }
    const result = await rateSetService.getRateSetById(req.params.id);
    if (result.error) return failFromServiceError(res, result);
    res.ok(result.data);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    let body;
    try {
      body = await createSchema.validate(req.body, { stripUnknown: true, abortEarly: false });
    } catch (validationErr) {
      return res.fail(
        400,
        'VALIDATION_ERROR',
        validationErr.errors.join('; '),
        validationErr.inner.map((issue) => ({ field: issue.path, message: issue.message }))
      );
    }
    const result = await rateSetService.createRateSet(body, actorOf(req));
    if (result.error) return failFromServiceError(res, result);
    res.created(result.data);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, detail, create };
