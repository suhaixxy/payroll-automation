// UC-003 phase 3: HTTP layer for the /api/uc003 calculation surface.
// Orchestration only — business rules live in services/runService.js.
// Responses use the standard shape from middleware/apiResponse.js (§2.5):
// res.ok / res.created / res.fail. RBAC is enforced on the ROUTES.

const runService = require('../services/runService');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Maps runService's error codes to HTTP responses (§2.5 status table).
function failFromServiceError(res, result) {
  switch (result.error) {
    case 'PERIOD_NOT_FOUND':
      return res.fail(404, 'PERIOD_NOT_FOUND', 'No pay period with that id.');
    case 'RUN_NOT_FOUND':
      return res.fail(404, 'RUN_NOT_FOUND', 'No calculation run with that id.');
    case 'LINE_NOT_FOUND':
      return res.fail(404, 'LINE_NOT_FOUND', 'No payroll line with that id.');
    case 'PERIOD_NOT_VALIDATED':
      return res.fail(
        409,
        'PERIOD_NOT_VALIDATED',
        `Pay period is '${result.currentStatus}', not 'validated' — nothing was calculated.`
      );
    case 'PERIOD_LOCKED':
      return res.fail(
        409,
        'PERIOD_LOCKED',
        `Pay period is '${result.currentStatus}' — its payroll can no longer be changed.`
      );
    case 'INVALID_PERIOD_STATE':
      return res.fail(
        409,
        'INVALID_PERIOD_STATE',
        `Pay period is '${result.currentStatus}' — only a 'calculated' period can be submitted for approval.`
      );
    case 'ALREADY_VOIDED':
      return res.fail(409, 'RUN_ALREADY_VOIDED', 'That run is already voided.');
    case 'NO_RATE_SET':
      return res.fail(
        422,
        'NO_RATE_SET',
        'No statutory rate set covers this period — create one before calculating.'
      );
    case 'NO_RUN':
      return res.fail(409, 'NO_RUN', 'This period has no completed calculation run yet.');
    case 'INCOMPLETE_LINES':
      return res.fail(
        422,
        'INCOMPLETE_LINES',
        `${result.incompleteCount} payroll line(s) are incomplete — resolve them and recalculate before submitting.`,
        [{ incompleteCount: result.incompleteCount }]
      );
    default:
      return res.fail(500, 'INTERNAL_ERROR', 'Unexpected calculation error.');
  }
}

// 404 (not 500) for ids that cannot possibly exist — avoids a Postgres
// uuid-cast error reaching the generic error handler.
function checkUuid(res, value, code, label) {
  if (UUID_PATTERN.test(value)) return true;
  res.fail(404, code, `Invalid ${label} id.`);
  return false;
}

const actorOf = (req) => ({ id: req.user.id, role: req.user.role });

async function listPeriods(req, res, next) {
  try {
    const result = await runService.listPeriods();
    res.ok(result.data);
  } catch (err) {
    next(err);
  }
}

async function listStaff(req, res, next) {
  try {
    const result = await runService.listStaff();
    res.ok(result.data);
  } catch (err) {
    next(err);
  }
}

async function calculate(req, res, next) {
  try {
    if (!checkUuid(res, req.params.periodId, 'PERIOD_NOT_FOUND', 'pay period')) return;
    const result = await runService.executeRun(req.params.periodId, actorOf(req), { recalculate: false });
    if (result.error) return failFromServiceError(res, result);
    res.created(result.data);
  } catch (err) {
    next(err);
  }
}

async function recalculate(req, res, next) {
  try {
    if (!checkUuid(res, req.params.periodId, 'PERIOD_NOT_FOUND', 'pay period')) return;
    const result = await runService.executeRun(req.params.periodId, actorOf(req), { recalculate: true });
    if (result.error) return failFromServiceError(res, result);
    res.created(result.data);
  } catch (err) {
    next(err);
  }
}

async function submitApproval(req, res, next) {
  try {
    if (!checkUuid(res, req.params.periodId, 'PERIOD_NOT_FOUND', 'pay period')) return;
    const result = await runService.submitForApproval(req.params.periodId, actorOf(req));
    if (result.error) return failFromServiceError(res, result);
    res.ok(result.data);
  } catch (err) {
    next(err);
  }
}

async function voidRun(req, res, next) {
  try {
    if (!checkUuid(res, req.params.runId, 'RUN_NOT_FOUND', 'calculation run')) return;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason) {
      return res.fail(400, 'VALIDATION_ERROR', 'Voiding a run requires a reason.', [
        { field: 'reason', message: 'required' },
      ]);
    }
    const result = await runService.voidRun(req.params.runId, reason, actorOf(req));
    if (result.error) return failFromServiceError(res, result);
    res.ok(result.data);
  } catch (err) {
    next(err);
  }
}

async function summary(req, res, next) {
  try {
    if (!checkUuid(res, req.params.periodId, 'PERIOD_NOT_FOUND', 'pay period')) return;
    const result = await runService.getSummary(req.params.periodId);
    if (result.error) return failFromServiceError(res, result);
    res.ok(result.data);
  } catch (err) {
    next(err);
  }
}

async function lines(req, res, next) {
  try {
    if (!checkUuid(res, req.params.periodId, 'PERIOD_NOT_FOUND', 'pay period')) return;
    const { status, search, sort, dir, page, limit } = req.query;
    const result = await runService.getLines(req.params.periodId, {
      status,
      search,
      sort,
      dir,
      page,
      limit,
    });
    if (result.error) return failFromServiceError(res, result);
    res.ok(result.data, result.meta);
  } catch (err) {
    next(err);
  }
}

async function line(req, res, next) {
  try {
    if (!checkUuid(res, req.params.lineId, 'LINE_NOT_FOUND', 'payroll line')) return;
    const result = await runService.getLine(req.params.lineId);
    if (result.error) return failFromServiceError(res, result);
    res.ok(result.data);
  } catch (err) {
    next(err);
  }
}

async function runs(req, res, next) {
  try {
    if (!checkUuid(res, req.params.periodId, 'PERIOD_NOT_FOUND', 'pay period')) return;
    const result = await runService.getRuns(req.params.periodId);
    if (result.error) return failFromServiceError(res, result);
    res.ok(result.data);
  } catch (err) {
    next(err);
  }
}

// §7.2 per-staff variance vs the previous period's authoritative run.
async function staffVariance(req, res, next) {
  try {
    if (!checkUuid(res, req.params.periodId, 'PERIOD_NOT_FOUND', 'pay period')) return;
    const result = await runService.getStaffVariance(req.params.periodId);
    if (result.error) return failFromServiceError(res, result);
    res.ok(result.data);
  } catch (err) {
    next(err);
  }
}

// RFC 4180 quoting; only quote when the value needs it.
function csvField(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// §7.9 payroll register export. The ONE endpoint that skips the JSON
// envelope — it serves a file download (text/csv + Content-Disposition).
async function exportCsv(req, res, next) {
  try {
    if (!checkUuid(res, req.params.periodId, 'PERIOD_NOT_FOUND', 'pay period')) return;
    const result = await runService.getRegister(req.params.periodId);
    if (result.error) return failFromServiceError(res, result);

    const { period, run, lines } = result.data;
    const header = [
      'staff_ref', 'staff_name', 'employment_type', 'cpf_eligible',
      'regular_hours', 'ot_hours', 'ph_hours', 'hourly_rate_used',
      'gross_from_hours', 'incentive_amount', 'adjustments_total', 'gross_total',
      'cpf_employee', 'cpf_employer', 'sdl_employer', 'net_payable',
      'line_status', 'incomplete_reasons',
    ];
    const rows = lines.map((entry) =>
      [
        entry.externalRef, entry.staffName, entry.employmentType, entry.cpfEligible,
        entry.regularHours, entry.otHours, entry.phHours, entry.hourlyRateUsed,
        entry.grossFromHours, entry.incentiveAmount, entry.adjustmentsTotal, entry.grossTotal,
        entry.cpfEmployee, entry.cpfEmployer, entry.sdl, entry.netPay,
        entry.lineStatus,
        (entry.incompleteReasons || []).map((reason) => reason.code).join('; '),
      ]
        .map(csvField)
        .join(',')
    );
    const csv = [header.join(','), ...rows].join('\r\n') + '\r\n';

    const filename = `payroll-register_${period.startDate}_to_${period.endDate}_run${run.runNumber}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // Leading BOM so Excel detects UTF-8 (staff names can be non-ASCII).
    res.send('\uFEFF' + csv);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPeriods,
  listStaff,
  calculate,
  recalculate,
  submitApproval,
  voidRun,
  summary,
  lines,
  line,
  runs,
  staffVariance,
  exportCsv,
};
