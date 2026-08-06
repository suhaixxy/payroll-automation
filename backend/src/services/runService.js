// UC-003 phase 3: calculation runs and versioning (guide §5.9, §6).
//
// A calculation NEVER overwrites: each execution is a calculation_runs row
// (run_number 1, 2, 3... per period) pinned forever to the statutory rate
// set it used, with its payroll_lines scoped to that run. Only the LATEST
// non-voided complete run is authoritative; voiding needs a reason; periods
// that are approved or paid refuse recalculation with 409.
//
// Status flow owned by UC-003 (guide §5.1):
//   validated → calculated         (a run completes)
//   calculated → pending_approval  (manager submits to approval)
//
// Everything runs in ONE transaction with the pay_period row locked
// (SELECT ... FOR UPDATE), so two concurrent calculations serialize instead
// of double-writing (guide §2.6).
//
// Money: the engine computes in integer cents; the run tables store
// NUMERIC(12,2) dollars (guide §2.4). Conversion happens exactly once, in
// centsToMoney, and API consumers receive the NUMERIC strings verbatim.

const { Op, QueryTypes } = require('sequelize');
const { sequelize, PayRate } = require('../models');
const calculationEngine = require('./calculationEngine');
const rateSetService = require('./rateSetService');
const { logUc003Action } = require('./uc003AuditService');
const { statuses: PAYROLL_STATUS, uc003Locked } = require('../../../shared/payrollStatus.json');

// §5.10: warn (never block) when net payable moves more than this fraction
// against the previous period. Team-tunable via env.
const VARIANCE_THRESHOLD = Number(process.env.UC003_VARIANCE_THRESHOLD || 0.15);

const centsToMoney = (cents) => (cents / 100).toFixed(2);
const toHundredths = (numericString) => Math.round(Number(numericString || 0) * 100);

async function loadPeriod(periodId, transaction, lock = false) {
  const rows = await sequelize.query(
    `SELECT id,
            status,
            to_char(start_date, 'YYYY-MM-DD') AS "startDate",
            to_char(end_date, 'YYYY-MM-DD') AS "endDate"
     FROM pay_period WHERE id = :periodId${lock ? ' FOR UPDATE' : ''}`,
    { replacements: { periodId }, type: QueryTypes.SELECT, transaction }
  );
  return rows[0] || null;
}

// The authoritative run: latest non-voided complete run for a period.
async function loadAuthoritativeRun(periodId) {
  const rows = await sequelize.query(
    `SELECT r.id,
            r.run_number AS "runNumber",
            r.status,
            r.total_gross AS "totalGross",
            r.total_employee_deductions AS "totalEmployeeDeductions",
            r.total_employer_cost AS "totalEmployerCost",
            r.total_net_payable AS "totalNetPayable",
            r.lines_complete AS "linesComplete",
            r.lines_incomplete AS "linesIncomplete",
            to_char(r.run_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS "runAt",
            u.name AS "runByName",
            s.version_label AS "rateSetVersion",
            r.rate_set_id AS "rateSetId"
     FROM calculation_runs r
     JOIN users u ON u.id = r.run_by
     JOIN statutory_rate_sets s ON s.id = r.rate_set_id
     WHERE r.period_id = :periodId AND r.status = 'complete'
     ORDER BY r.run_number DESC
     LIMIT 1`,
    { replacements: { periodId }, type: QueryTypes.SELECT }
  );
  return rows[0] || null;
}

// §5.10 variance: current run's net payable vs the previous period's latest
// complete run. Warn, never block.
async function checkVariance(period, currentNetMoney) {
  const rows = await sequelize.query(
    `SELECT r.total_net_payable AS "previousNet",
            r.period_id AS "previousPeriodId",
            to_char(p.start_date, 'YYYY-MM-DD') AS "previousStartDate"
     FROM calculation_runs r
     JOIN pay_period p ON p.id = r.period_id
     WHERE p.start_date < :startDate AND r.status = 'complete'
     ORDER BY p.start_date DESC, r.run_number DESC
     LIMIT 1`,
    { replacements: { startDate: period.startDate }, type: QueryTypes.SELECT }
  );
  const previous = rows[0];
  if (!previous || Number(previous.previousNet) <= 0) {
    return { varianceWarning: false, variance: null };
  }

  const previousNet = Number(previous.previousNet);
  const currentNet = Number(currentNetMoney);
  const pctChange = Math.abs(currentNet - previousNet) / previousNet;

  return {
    varianceWarning: pctChange > VARIANCE_THRESHOLD,
    variance: {
      previousPeriodId: previous.previousPeriodId,
      previousStartDate: previous.previousStartDate,
      previousNetPayable: previous.previousNet,
      currentNetPayable: currentNetMoney,
      pctChange: Number((pctChange * 100).toFixed(1)),
      thresholdPct: VARIANCE_THRESHOLD * 100,
    },
  };
}

/**
 * Executes one calculation run (§3.1 calculate / §3.2 recalculate — same
 * mechanics, different entry guards).
 * @param {string} periodId
 * @param {{id: string, role: string}} actor - from the JWT.
 * @param {{recalculate: boolean}} options
 */
async function executeRun(periodId, actor, { recalculate = false } = {}) {
  // Rate set resolution happens before the transaction — it's read-only.
  const probe = await loadPeriod(periodId);
  if (!probe) return { error: 'PERIOD_NOT_FOUND' };
  const rateSet = await rateSetService.getRateSetForDate(probe.endDate);
  if (!rateSet) return { error: 'NO_RATE_SET' };

  const outcome = await sequelize.transaction(async (transaction) => {
    // Lock the period row: concurrent runs on the same period serialize here.
    const period = await loadPeriod(periodId, transaction, true);

    if (recalculate) {
      // §5.9: recalculating is refused once the period is approved or paid.
      if (uc003Locked.includes(period.status)) {
        return { error: 'PERIOD_LOCKED', currentStatus: period.status };
      }
      if (
        ![PAYROLL_STATUS.VALIDATED, PAYROLL_STATUS.CALCULATED, PAYROLL_STATUS.PENDING_APPROVAL]
          .includes(period.status)
      ) {
        return { error: 'PERIOD_NOT_VALIDATED', currentStatus: period.status };
      }
    } else if (period.status !== PAYROLL_STATUS.VALIDATED) {
      // §3.5: calculating anything but a validated period is a state conflict.
      return { error: 'PERIOD_NOT_VALIDATED', currentStatus: period.status };
    }

    const [{ nextRunNumber }] = await sequelize.query(
      `SELECT COALESCE(MAX(run_number), 0) + 1 AS "nextRunNumber"
       FROM calculation_runs WHERE period_id = :periodId`,
      { replacements: { periodId }, type: QueryTypes.SELECT, transaction }
    );

    const [[run]] = await sequelize.query(
      `INSERT INTO calculation_runs (period_id, run_number, rate_set_id, status, run_by)
       VALUES (:periodId, :runNumber, :rateSetId, 'running', :runBy)
       RETURNING id`,
      {
        replacements: { periodId, runNumber: nextRunNumber, rateSetId: rateSet.id, runBy: actor.id },
        transaction,
      }
    );

    // ── load calculation inputs (same frozen-snapshot rules as before) ──
    const staffRows = await sequelize.query(
      `SELECT id,
              external_ref AS "externalRef",
              full_name AS "fullName",
              employment_type AS "employmentType",
              cpf_eligible AS "cpfEligible",
              to_char(date_of_birth, 'YYYY-MM-DD') AS "dateOfBirth"
       FROM staff WHERE status = 'active' ORDER BY external_ref`,
      { type: QueryTypes.SELECT, transaction }
    );

    const hourRows = await sequelize.query(
      `SELECT staff_id AS "staffId", total_hours AS "totalHours",
              ot_hours AS "otHours", ph_hours AS "phHours"
       FROM timesheet
       WHERE pay_period_id = :periodId AND is_frozen = true
         AND match_status = 'matched' AND staff_id IS NOT NULL`,
      { replacements: { periodId }, type: QueryTypes.SELECT, transaction }
    );
    const hoursByStaff = new Map();
    for (const row of hourRows) {
      if (!hoursByStaff.has(row.staffId)) hoursByStaff.set(row.staffId, []);
      hoursByStaff.get(row.staffId).push({
        totalHundredths: toHundredths(row.totalHours),
        otHundredths: toHundredths(row.otHours),
        phHundredths: toHundredths(row.phHours),
      });
    }

    const rateRows = await PayRate.findAll({
      where: { effectiveFrom: { [Op.lte]: period.startDate } },
      order: [['effectiveFrom', 'DESC']],
      transaction,
    });
    const rateByStaff = new Map();
    for (const rate of rateRows) {
      if (!rateByStaff.has(rate.staffId)) {
        rateByStaff.set(rate.staffId, { hourlyRateCents: rate.hourlyRateCents });
      }
    }

    const inputRows = await sequelize.query(
      `SELECT staff_id AS "staffId", input_type AS "inputType", quantity, unit_value AS "unitValue"
       FROM performance_inputs
       WHERE period_id = :periodId AND deleted_at IS NULL`,
      { replacements: { periodId }, type: QueryTypes.SELECT, transaction }
    );
    const inputsByStaff = new Map();
    for (const input of inputRows) {
      if (!inputsByStaff.has(input.staffId)) inputsByStaff.set(input.staffId, []);
      inputsByStaff.get(input.staffId).push({
        inputType: input.inputType,
        quantityHundredths: toHundredths(input.quantity),
        unitValueCents: toHundredths(input.unitValue),
      });
    }

    // §5.4: non-deleted adjustments fold into gross (and, when
    // cpf_applicable, into the CPF wage base) inside the engine.
    const adjustmentRows = await sequelize.query(
      `SELECT staff_id AS "staffId", adjustment_type AS "adjustmentType",
              amount, cpf_applicable AS "cpfApplicable", reason
       FROM payroll_adjustments
       WHERE period_id = :periodId AND deleted_at IS NULL`,
      { replacements: { periodId }, type: QueryTypes.SELECT, transaction }
    );
    const adjustmentsByStaff = new Map();
    for (const adjustment of adjustmentRows) {
      if (!adjustmentsByStaff.has(adjustment.staffId)) adjustmentsByStaff.set(adjustment.staffId, []);
      adjustmentsByStaff.get(adjustment.staffId).push({
        adjustmentType: adjustment.adjustmentType,
        amountCents: toHundredths(adjustment.amount),
        cpfApplicable: adjustment.cpfApplicable,
        reason: adjustment.reason,
      });
    }

    // ── calculate and persist the run-scoped lines ──
    const totals = { gross: 0, employeeDeductions: 0, employerCost: 0, net: 0 };
    let linesComplete = 0;
    let linesIncomplete = 0;

    for (const staff of staffRows) {
      const result = calculationEngine.calculateLine({
        staff,
        hourRows: hoursByStaff.get(staff.id) || [],
        rate: rateByStaff.get(staff.id) || null,
        performanceInputs: inputsByStaff.get(staff.id) || [],
        adjustments: adjustmentsByStaff.get(staff.id) || [],
        rateSet,
        periodEndDate: period.endDate,
      });

      if (result.lineStatus === 'complete') {
        linesComplete += 1;
        totals.gross += result.grossTotalCents;
        totals.employeeDeductions += result.employeeDeductionsCents;
        totals.employerCost += result.employerCostCents;
        totals.net += result.netPayCents;
      } else {
        linesIncomplete += 1; // §5.8: excluded from every total
      }

      await sequelize.query(
        `INSERT INTO payroll_lines
           (run_id, staff_id, period_id, regular_hours, ot_hours, ph_hours,
            hourly_rate_used, gross_from_hours, incentive_amount, adjustments_total,
            gross_total, cpf_employee, cpf_employer, sdl, net_pay,
            line_status, incomplete_reasons, calc_breakdown)
         VALUES
           (:runId, :staffId, :periodId, :regularHours, :otHours, :phHours,
            :hourlyRateUsed, :grossFromHours, :incentiveAmount, :adjustmentsTotal,
            :grossTotal, :cpfEmployee, :cpfEmployer, :sdl, :netPay,
            :lineStatus, :incompleteReasons, :calcBreakdown)`,
        {
          replacements: {
            runId: run.id,
            staffId: staff.id,
            periodId,
            regularHours: (result.regularHundredths / 100).toFixed(2),
            otHours: (result.otHundredths / 100).toFixed(2),
            phHours: (result.phHundredths / 100).toFixed(2),
            hourlyRateUsed: result.hourlyRateCents === null ? null : centsToMoney(result.hourlyRateCents),
            grossFromHours: centsToMoney(result.grossFromHoursCents),
            incentiveAmount: centsToMoney(result.incentiveCents),
            adjustmentsTotal: centsToMoney(result.adjustmentsTotalCents),
            grossTotal: centsToMoney(result.grossTotalCents),
            cpfEmployee: centsToMoney(result.cpfEmployeeCents),
            cpfEmployer: centsToMoney(result.cpfEmployerCents),
            sdl: centsToMoney(result.sdlCents),
            netPay: centsToMoney(result.netPayCents),
            lineStatus: result.lineStatus,
            incompleteReasons:
              result.incompleteReasons.length > 0 ? JSON.stringify(result.incompleteReasons) : null,
            calcBreakdown: JSON.stringify(result.breakdown),
          },
          transaction,
        }
      );
    }

    await sequelize.query(
      `UPDATE calculation_runs
       SET status = 'complete',
           total_gross = :gross,
           total_employee_deductions = :employeeDeductions,
           total_employer_cost = :employerCost,
           total_net_payable = :net,
           lines_complete = :linesComplete,
           lines_incomplete = :linesIncomplete
       WHERE id = :runId`,
      {
        replacements: {
          runId: run.id,
          gross: centsToMoney(totals.gross),
          employeeDeductions: centsToMoney(totals.employeeDeductions),
          employerCost: centsToMoney(totals.employerCost),
          net: centsToMoney(totals.net),
          linesComplete,
          linesIncomplete,
        },
        transaction,
      }
    );

    // §5.1: a successful run lands the period on 'calculated'. Submission to
    // approval is a separate, manager-only action.
    await sequelize.query(
      `UPDATE pay_period SET status = :status, updated_at = now() WHERE id = :periodId`,
      { replacements: { periodId, status: PAYROLL_STATUS.CALCULATED }, transaction }
    );

    return {
      period,
      runId: run.id,
      runNumber: nextRunNumber,
      totals,
      linesComplete,
      linesIncomplete,
    };
  });

  if (outcome.error) return outcome;

  const { varianceWarning, variance } = await checkVariance(
    outcome.period,
    centsToMoney(outcome.totals.net)
  );

  await logUc003Action({
    entity: 'calculation_run',
    entityId: outcome.runId,
    action: recalculate ? 'recalculate' : 'calculate',
    after: {
      periodId,
      runNumber: outcome.runNumber,
      recalculation: recalculate,
      rateSetId: rateSet.id,
      rateSetVersion: rateSet.versionLabel,
      linesComplete: outcome.linesComplete,
      linesIncomplete: outcome.linesIncomplete,
      totalNetPayable: centsToMoney(outcome.totals.net),
      varianceWarning,
    },
    actorId: actor.id,
    actorRole: actor.role,
  });

  return {
    data: {
      periodId,
      status: PAYROLL_STATUS.CALCULATED,
      run: {
        id: outcome.runId,
        runNumber: outcome.runNumber,
        rateSetVersion: rateSet.versionLabel,
      },
      totals: {
        gross: centsToMoney(outcome.totals.gross),
        employeeDeductions: centsToMoney(outcome.totals.employeeDeductions),
        employerCost: centsToMoney(outcome.totals.employerCost),
        netPayable: centsToMoney(outcome.totals.net),
      },
      linesComplete: outcome.linesComplete,
      linesIncomplete: outcome.linesIncomplete,
      varianceWarning,
      variance,
    },
  };
}

/** §6 submit-approval: calculated → pending_approval, manager only, 422 if
 *  any line of the authoritative run is incomplete. */
async function submitForApproval(periodId, actor) {
  const period = await loadPeriod(periodId);
  if (!period) return { error: 'PERIOD_NOT_FOUND' };
  if (period.status !== PAYROLL_STATUS.CALCULATED) {
    return { error: 'INVALID_PERIOD_STATE', currentStatus: period.status };
  }

  const run = await loadAuthoritativeRun(periodId);
  if (!run) return { error: 'NO_RUN' };

  const [{ incompleteCount }] = await sequelize.query(
    `SELECT COUNT(*)::int AS "incompleteCount"
     FROM payroll_lines WHERE run_id = :runId AND line_status = 'incomplete'`,
    { replacements: { runId: run.id }, type: QueryTypes.SELECT }
  );
  if (incompleteCount > 0) {
    return { error: 'INCOMPLETE_LINES', incompleteCount };
  }

  await sequelize.query(
    `UPDATE pay_period SET status = :status, updated_at = now() WHERE id = :periodId`,
    { replacements: { periodId, status: PAYROLL_STATUS.PENDING_APPROVAL } }
  );

  await logUc003Action({
    entity: 'pay_period',
    entityId: periodId,
    action: 'submit',
    before: { status: PAYROLL_STATUS.CALCULATED },
    after: { status: PAYROLL_STATUS.PENDING_APPROVAL, runId: run.id, runNumber: run.runNumber },
    actorId: actor.id,
    actorRole: actor.role,
  });

  return { data: { periodId, status: PAYROLL_STATUS.PENDING_APPROVAL, runNumber: run.runNumber } };
}

/** §3.3 void: needs a reason; refused once the period is approved or paid. */
async function voidRun(runId, reason, actor) {
  const rows = await sequelize.query(
    `SELECT r.id, r.status, r.run_number AS "runNumber", r.period_id AS "periodId",
            p.status AS "periodStatus"
     FROM calculation_runs r JOIN pay_period p ON p.id = r.period_id
     WHERE r.id = :runId`,
    { replacements: { runId }, type: QueryTypes.SELECT }
  );
  const run = rows[0];
  if (!run) return { error: 'RUN_NOT_FOUND' };
  if (run.status === 'voided') return { error: 'ALREADY_VOIDED' };
  if (uc003Locked.includes(run.periodStatus)) {
    return { error: 'PERIOD_LOCKED', currentStatus: run.periodStatus };
  }

  await sequelize.query(
    `UPDATE calculation_runs SET status = 'voided', void_reason = :reason WHERE id = :runId`,
    { replacements: { runId, reason } }
  );

  await logUc003Action({
    entity: 'calculation_run',
    entityId: runId,
    action: 'void',
    before: { status: run.status },
    after: { status: 'voided', voidReason: reason },
    actorId: actor.id,
    actorRole: actor.role,
  });

  return { data: { runId, runNumber: run.runNumber, status: 'voided' } };
}

/** §6 summary: period, authoritative run with its four totals, variance. */
async function getSummary(periodId) {
  const period = await loadPeriod(periodId);
  if (!period) return { error: 'PERIOD_NOT_FOUND' };

  const run = await loadAuthoritativeRun(periodId);
  if (!run) return { data: { period, run: null, varianceWarning: false, variance: null } };

  const { varianceWarning, variance } = await checkVariance(period, run.totalNetPayable);
  return {
    data: {
      period,
      run: {
        id: run.id,
        runNumber: run.runNumber,
        rateSetVersion: run.rateSetVersion,
        runAt: run.runAt,
        runByName: run.runByName,
        totals: {
          gross: run.totalGross,
          employeeDeductions: run.totalEmployeeDeductions,
          employerCost: run.totalEmployerCost,
          netPayable: run.totalNetPayable,
        },
        linesComplete: run.linesComplete,
        linesIncomplete: run.linesIncomplete,
      },
      varianceWarning,
      variance,
    },
  };
}

const LINE_SORTS = {
  name: 's.full_name',
  gross: 'pl.gross_total',
  net: 'pl.net_pay',
  status: 'pl.line_status',
};

/** §6 lines: the authoritative run's lines with status/search/sort/paging. */
async function getLines(periodId, { status, search, sort, dir, page = 1, limit = 20 } = {}) {
  const period = await loadPeriod(periodId);
  if (!period) return { error: 'PERIOD_NOT_FOUND' };

  const run = await loadAuthoritativeRun(periodId);
  if (!run) return { data: { run: null, lines: [] }, meta: { page: 1, limit, total: 0 } };

  const filters = ['pl.run_id = :runId'];
  const replacements = { runId: run.id };
  if (status === 'complete' || status === 'incomplete') {
    filters.push('pl.line_status = :status');
    replacements.status = status;
  }
  if (search) {
    filters.push('(s.full_name ILIKE :search OR s.external_ref ILIKE :search)');
    replacements.search = `%${search}%`;
  }

  const sortColumn = LINE_SORTS[sort] || LINE_SORTS.name;
  const sortDir = dir === 'desc' ? 'DESC' : 'ASC';
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  replacements.limit = safeLimit;
  replacements.offset = (safePage - 1) * safeLimit;

  const where = filters.join(' AND ');
  const lines = await sequelize.query(
    `SELECT pl.id, pl.staff_id AS "staffId",
            s.full_name AS "staffName", s.external_ref AS "externalRef",
            s.employment_type AS "employmentType", s.cpf_eligible AS "cpfEligible",
            pl.regular_hours AS "regularHours", pl.ot_hours AS "otHours", pl.ph_hours AS "phHours",
            pl.hourly_rate_used AS "hourlyRateUsed",
            pl.gross_from_hours AS "grossFromHours", pl.incentive_amount AS "incentiveAmount",
            pl.adjustments_total AS "adjustmentsTotal", pl.gross_total AS "grossTotal",
            pl.cpf_employee AS "cpfEmployee", pl.cpf_employer AS "cpfEmployer",
            pl.sdl, pl.net_pay AS "netPay",
            pl.line_status AS "lineStatus", pl.incomplete_reasons AS "incompleteReasons"
     FROM payroll_lines pl JOIN staff s ON s.id = pl.staff_id
     WHERE ${where}
     ORDER BY ${sortColumn} ${sortDir}, s.external_ref ASC
     LIMIT :limit OFFSET :offset`,
    { replacements, type: QueryTypes.SELECT }
  );
  const [{ total }] = await sequelize.query(
    `SELECT COUNT(*)::int AS total
     FROM payroll_lines pl JOIN staff s ON s.id = pl.staff_id
     WHERE ${where}`,
    { replacements, type: QueryTypes.SELECT }
  );

  return {
    data: { run: { id: run.id, runNumber: run.runNumber }, lines },
    meta: { page: safePage, limit: safeLimit, total },
  };
}

/** §6 line detail: includes the full calc_breakdown and run provenance. */
async function getLine(lineId) {
  const rows = await sequelize.query(
    `SELECT pl.*, pl.incomplete_reasons AS "incompleteReasons", pl.calc_breakdown AS "calcBreakdown",
            s.full_name AS "staffName", s.external_ref AS "externalRef",
            s.employment_type AS "employmentType", s.cpf_eligible AS "cpfEligible",
            r.run_number AS "runNumber", r.status AS "runStatus",
            to_char(r.run_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS "runAt",
            u.name AS "runByName", rs.version_label AS "rateSetVersion"
     FROM payroll_lines pl
     JOIN staff s ON s.id = pl.staff_id
     JOIN calculation_runs r ON r.id = pl.run_id
     JOIN users u ON u.id = r.run_by
     JOIN statutory_rate_sets rs ON rs.id = r.rate_set_id
     WHERE pl.id = :lineId`,
    { replacements: { lineId }, type: QueryTypes.SELECT }
  );
  if (!rows[0]) return { error: 'LINE_NOT_FOUND' };
  return { data: rows[0] };
}

/** §6 run history, newest first, voided included (with reasons). */
async function getRuns(periodId) {
  const period = await loadPeriod(periodId);
  if (!period) return { error: 'PERIOD_NOT_FOUND' };

  const runs = await sequelize.query(
    `SELECT r.id, r.run_number AS "runNumber", r.status,
            r.total_gross AS "totalGross", r.total_net_payable AS "totalNetPayable",
            r.lines_complete AS "linesComplete", r.lines_incomplete AS "linesIncomplete",
            r.void_reason AS "voidReason",
            to_char(r.run_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS "runAt",
            u.name AS "runByName", s.version_label AS "rateSetVersion"
     FROM calculation_runs r
     JOIN users u ON u.id = r.run_by
     JOIN statutory_rate_sets s ON s.id = r.rate_set_id
     WHERE r.period_id = :periodId
     ORDER BY r.run_number DESC`,
    { replacements: { periodId }, type: QueryTypes.SELECT }
  );
  return { data: { period, runs } };
}

/** Active staff for form pickers (read-only shared-table access, §3.1). */
async function listStaff() {
  const staff = await sequelize.query(
    `SELECT id,
            external_ref AS "externalRef",
            full_name AS "fullName",
            employment_type AS "employmentType",
            cpf_eligible AS "cpfEligible"
     FROM staff
     WHERE status = 'active'
     ORDER BY external_ref`,
    { type: QueryTypes.SELECT }
  );
  return { data: { staff } };
}

/** Periods with status for the picker (read-only, any authenticated user). */
async function listPeriods() {
  const periods = await sequelize.query(
    `SELECT id,
            to_char(start_date, 'YYYY-MM-DD') AS "startDate",
            to_char(end_date, 'YYYY-MM-DD') AS "endDate",
            status
     FROM pay_period
     ORDER BY start_date`,
    { type: QueryTypes.SELECT }
  );
  return { data: { periods } };
}

module.exports = {
  executeRun,
  submitForApproval,
  voidRun,
  getSummary,
  getLines,
  getLine,
  getRuns,
  listPeriods,
  listStaff,
  VARIANCE_THRESHOLD,
};
