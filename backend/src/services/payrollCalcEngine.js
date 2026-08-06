// UC-003: orchestrates the payroll calculation for one pay period.
//
// The whole run happens inside ONE transaction: delete the period's old
// payroll lines -> rebuild them from the frozen UC-002 snapshot -> move the
// period to pending_approval. That makes a re-run (after a UC-004
// rejection) idempotent — it can never double-count or half-finish.
//
// Phase 2 split of responsibilities:
//   rateSetService     — loads the statutory rate set effective for the period
//   calculationEngine  — pure per-line maths (CPF, SDL, rounding, breakdown)
//   this module        — data loading, persistence, totals, variance, audit
//
// Money: integer cents everywhere (NUMERIC columns arrive as strings and are
// converted once at load). SDL is EMPLOYER-BORNE (guide §5.6): it is not
// part of employee deductions and never reduces net pay.
//
// Shared tables (pay_period, staff, timesheet) are read with raw SQL
// through the SAME Sequelize connection/transaction, so UC-003 never
// defines models for tables it doesn't own.

const { Op, QueryTypes } = require('sequelize');
const { sequelize, PayrollLine, PayRate } = require('../models');
const calculationEngine = require('./calculationEngine');
const rateSetService = require('./rateSetService');
const auditService = require('./auditService');
// Shared status contract (guide §5.1) — never hardcode status strings.
const { statuses: PAYROLL_STATUS } = require('../../../shared/payrollStatus.json');

// Warning flow 5a: if the period's derived gross total differs from the
// previous period's by more than this fraction, the run still completes but
// returns varianceWarning: true and writes an audit entry. Team-tunable.
const VARIANCE_THRESHOLD = 0.2; // 20%

// NUMERIC(6,2)/(10,2) values arrive as strings like "10.50" — turn them into
// integer hundredths so all later maths is integer-exact.
function toHundredths(numericString) {
  return Math.round(Number(numericString || 0) * 100);
}

async function loadPeriod(payPeriodId, transaction) {
  const rows = await sequelize.query(
    `SELECT id,
            status,
            to_char(start_date, 'YYYY-MM-DD') AS "startDate",
            to_char(end_date, 'YYYY-MM-DD') AS "endDate"
     FROM pay_period WHERE id = :payPeriodId`,
    { replacements: { payPeriodId }, type: QueryTypes.SELECT, transaction }
  );
  return rows[0] || null;
}

/**
 * Derived totals for a period — always a SUM over its COMPLETE payroll
 * lines, never a stored figure. Employee deductions are CPF (employee) ONLY;
 * SDL and employer CPF sit in employer cost (guide §5.6).
 * @param {string} payPeriodId
 * @param {object} [transaction]
 */
async function derivePeriodTotals(payPeriodId, transaction) {
  const rows = await sequelize.query(
    `SELECT COALESCE(SUM(gross_pay_cents + incentive_cents), 0) AS "grossCents",
            COALESCE(SUM(cpf_employee_cents), 0) AS "deductionsCents",
            COALESCE(SUM(cpf_employer_cents + sdl_cents), 0) AS "employerCostCents",
            COALESCE(SUM(net_pay_cents), 0) AS "netCents",
            COUNT(*) AS "completeCount"
     FROM payroll_line
     WHERE pay_period_id = :payPeriodId AND line_status = 'complete'`,
    { replacements: { payPeriodId }, type: QueryTypes.SELECT, transaction }
  );
  const row = rows[0];
  return {
    grossCents: Number(row.grossCents),
    deductionsCents: Number(row.deductionsCents),
    employerCostCents: Number(row.employerCostCents),
    netCents: Number(row.netCents),
    completeCount: Number(row.completeCount),
  };
}

// Warning flow 5a: compare this period's derived gross against the previous
// period's (also derived — the previous period must already have payroll
// lines to compare against, otherwise there is simply nothing to check).
async function checkVariance(period, currentGrossCents) {
  const rows = await sequelize.query(
    `SELECT id, to_char(start_date, 'YYYY-MM-DD') AS "startDate"
     FROM pay_period
     WHERE start_date < :startDate
     ORDER BY start_date DESC
     LIMIT 1`,
    { replacements: { startDate: period.startDate }, type: QueryTypes.SELECT }
  );
  const previous = rows[0];
  if (!previous) return { varianceWarning: false, variance: null };

  const previousTotals = await derivePeriodTotals(previous.id);
  if (previousTotals.completeCount === 0) return { varianceWarning: false, variance: null };

  const difference = Math.abs(currentGrossCents - previousTotals.grossCents);
  // A previous total of zero means any spend at all is an infinite jump —
  // that's exactly the kind of swing the warning exists for.
  const varianceWarning =
    previousTotals.grossCents === 0
      ? currentGrossCents > 0
      : difference / previousTotals.grossCents > VARIANCE_THRESHOLD;

  return {
    varianceWarning,
    variance: {
      previousPeriodId: previous.id,
      previousGrossCents: previousTotals.grossCents,
      currentGrossCents,
      thresholdPct: VARIANCE_THRESHOLD * 100,
    },
  };
}

/**
 * Runs the full payroll calculation for a validated pay period.
 * @param {string} payPeriodId
 * @param {string} actor - who triggered the run (for the audit log).
 * @returns {Promise<object>} { error } for the controller's 404/409/422
 *   cases, otherwise { data } matching the POST /payroll/calculate response.
 */
async function calculatePayroll(payPeriodId, actor) {
  const period = await loadPeriod(payPeriodId);
  if (!period) return { error: 'NOT_FOUND' };
  // 409 guard: only a UC-002-validated period may be calculated.
  if (period.status !== PAYROLL_STATUS.VALIDATED) {
    return { error: 'NOT_VALIDATED', currentStatus: period.status };
  }

  // Phase 2.1: every statutory figure comes from the rate set effective at
  // the period's end date — nothing is read from hardcoded config anymore.
  const rateSet = await rateSetService.getRateSetForDate(period.endDate);
  if (!rateSet) return { error: 'NO_RATE_SET' };

  const built = await sequelize.transaction(async (transaction) => {
    // Re-run safety (UC-004 rejection loop): wipe this period's lines first.
    await PayrollLine.destroy({ where: { payPeriodId }, transaction });

    const staffRows = await sequelize.query(
      `SELECT id,
              external_ref AS "externalRef",
              full_name AS "fullName",
              employment_type AS "employmentType",
              cpf_eligible AS "cpfEligible",
              to_char(date_of_birth, 'YYYY-MM-DD') AS "dateOfBirth"
       FROM staff
       WHERE status = 'active'
       ORDER BY external_ref`,
      { type: QueryTypes.SELECT, transaction }
    );

    // The frozen UC-002 snapshot, row by row (not pre-summed) so the engine
    // can validate each shift before trusting it (INVALID_HOURS).
    const hourRows = await sequelize.query(
      `SELECT staff_id AS "staffId",
              total_hours AS "totalHours",
              ot_hours AS "otHours",
              ph_hours AS "phHours"
       FROM timesheet
       WHERE pay_period_id = :payPeriodId
         AND is_frozen = true
         AND match_status = 'matched'
         AND staff_id IS NOT NULL`,
      { replacements: { payPeriodId }, type: QueryTypes.SELECT, transaction }
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

    // Newest rate that was already effective when the period started, per
    // staff member — historic periods recalculate with their historic rate.
    // (OT/PH multipliers come from the rate SET, not the pay rate — §5.2.)
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

    // §5.3: performance inputs from the guide-model table (quantity ×
    // unit_value), soft-deleted rows excluded.
    const inputRows = await sequelize.query(
      `SELECT staff_id AS "staffId",
              input_type AS "inputType",
              quantity,
              unit_value AS "unitValue"
       FROM performance_inputs
       WHERE period_id = :payPeriodId AND deleted_at IS NULL`,
      { replacements: { payPeriodId }, type: QueryTypes.SELECT, transaction }
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

    const lines = staffRows.map((staff) => {
      const result = calculationEngine.calculateLine({
        staff,
        hourRows: hoursByStaff.get(staff.id) || [],
        rate: rateByStaff.get(staff.id) || null,
        performanceInputs: inputsByStaff.get(staff.id) || [],
        rateSet,
        periodEndDate: period.endDate,
      });
      return {
        record: {
          payPeriodId: period.id,
          staffId: staff.id,
          grossPayCents: result.grossFromHoursCents,
          incentiveCents: result.incentiveCents,
          cpfEmployeeCents: result.cpfEmployeeCents,
          cpfEmployerCents: result.cpfEmployerCents,
          sdlCents: result.sdlCents,
          otherDeductionsCents: 0,
          netPayCents: result.netPayCents,
          lineStatus: result.lineStatus,
          notes:
            result.incompleteReasons.length > 0
              ? result.incompleteReasons.map((reason) => reason.message).join(' ')
              : null,
          calcBreakdown: result.breakdown,
          incompleteReasons:
            result.incompleteReasons.length > 0 ? result.incompleteReasons : null,
        },
        display: {
          staffName: staff.fullName,
          externalRef: staff.externalRef,
          employmentType: staff.employmentType,
        },
      };
    });

    await PayrollLine.bulkCreate(
      lines.map((line) => line.record),
      { transaction }
    );

    // Handoff to UC-004: the period now waits for manager review.
    await sequelize.query(
      `UPDATE pay_period SET status = :status, updated_at = now() WHERE id = :payPeriodId`,
      {
        replacements: { payPeriodId, status: PAYROLL_STATUS.PENDING_APPROVAL },
        transaction,
      }
    );

    return lines;
  });

  // Everything below is post-commit reporting — derived totals, variance
  // check, audit trail. The calculation itself is already safely stored.
  const totals = await derivePeriodTotals(payPeriodId);
  const { varianceWarning, variance } = await checkVariance(period, totals.grossCents);

  const incomplete = built.filter((line) => line.record.lineStatus === 'incomplete');

  await auditService.logAction({
    entityType: 'pay_period',
    entityId: payPeriodId,
    action: 'payroll_calculated',
    actor,
    detail: {
      rateSetId: rateSet.id,
      rateSetVersion: rateSet.versionLabel,
      lineCount: built.length,
      incompleteCount: incomplete.length,
      totals,
      varianceWarning,
      statusChange: `${PAYROLL_STATUS.VALIDATED} -> ${PAYROLL_STATUS.PENDING_APPROVAL}`,
    },
  });
  if (incomplete.length > 0) {
    await auditService.logAction({
      entityType: 'pay_period',
      entityId: payPeriodId,
      action: 'payroll_lines_incomplete',
      actor,
      detail: {
        staff: incomplete.map((line) => ({
          name: line.display.staffName,
          reasons: line.record.incompleteReasons,
        })),
      },
    });
  }
  if (varianceWarning) {
    await auditService.logAction({
      entityType: 'pay_period',
      entityId: payPeriodId,
      action: 'payroll_variance_warning',
      actor,
      detail: variance,
    });
  }

  return {
    data: {
      payPeriodId,
      status: PAYROLL_STATUS.PENDING_APPROVAL,
      rateSet: { id: rateSet.id, versionLabel: rateSet.versionLabel },
      totals: {
        grossCents: totals.grossCents,
        deductionsCents: totals.deductionsCents,
        employerCostCents: totals.employerCostCents,
        netCents: totals.netCents,
      },
      lineCount: built.length,
      incompleteCount: incomplete.length,
      varianceWarning,
      variance,
    },
  };
}

/**
 * Read model for GET /payroll/:payPeriodId — the per-staff lines, derived
 * totals, and the previous-period comparison used for the variance check.
 * @param {string} payPeriodId
 * @returns {Promise<object>} { error } for 404 cases, otherwise { data }.
 */
async function getPayrollForPeriod(payPeriodId) {
  const period = await loadPeriod(payPeriodId);
  if (!period) return { error: 'NOT_FOUND' };

  const lines = await sequelize.query(
    `SELECT pl.id,
            pl.staff_id AS "staffId",
            s.full_name AS "staffName",
            s.external_ref AS "externalRef",
            s.employment_type AS "employmentType",
            s.cpf_eligible AS "cpfEligible",
            pl.gross_pay_cents AS "grossPayCents",
            pl.incentive_cents AS "incentiveCents",
            pl.cpf_employee_cents AS "cpfEmployeeCents",
            pl.cpf_employer_cents AS "cpfEmployerCents",
            pl.sdl_cents AS "sdlCents",
            pl.other_deductions_cents AS "otherDeductionsCents",
            pl.net_pay_cents AS "netPayCents",
            pl.line_status AS "lineStatus",
            pl.notes,
            pl.calc_breakdown AS "calcBreakdown",
            pl.incomplete_reasons AS "incompleteReasons"
     FROM payroll_line pl
     JOIN staff s ON s.id = pl.staff_id
     WHERE pl.pay_period_id = :payPeriodId
     ORDER BY s.external_ref`,
    { replacements: { payPeriodId }, type: QueryTypes.SELECT }
  );
  if (lines.length === 0) return { error: 'NO_LINES' };

  const totals = await derivePeriodTotals(payPeriodId);
  const { varianceWarning, variance } = await checkVariance(period, totals.grossCents);

  return {
    data: {
      payPeriod: period,
      totals: {
        grossCents: totals.grossCents,
        deductionsCents: totals.deductionsCents,
        employerCostCents: totals.employerCostCents,
        netCents: totals.netCents,
      },
      lineCount: lines.length,
      incompleteCount: lines.filter((line) => line.lineStatus === 'incomplete').length,
      varianceWarning,
      variance,
      lines,
    },
  };
}

/**
 * All pay periods with their status — the UC-001 pay-periods API doesn't
 * expose status, and the PayrollCalc page needs it to show which periods
 * are actually 'validated' and ready to calculate. Read-only.
 */
async function listPeriodsWithStatus() {
  return sequelize.query(
    `SELECT id,
            to_char(start_date, 'YYYY-MM-DD') AS "startDate",
            to_char(end_date, 'YYYY-MM-DD') AS "endDate",
            status
     FROM pay_period
     ORDER BY start_date`,
    { type: QueryTypes.SELECT }
  );
}

module.exports = {
  calculatePayroll,
  getPayrollForPeriod,
  derivePeriodTotals,
  listPeriodsWithStatus,
  VARIANCE_THRESHOLD,
};
