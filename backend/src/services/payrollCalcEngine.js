// UC-003: orchestrates the payroll calculation for one pay period.
//
// The whole run happens inside ONE transaction: delete the period's old
// payroll lines -> rebuild them from the frozen UC-002 snapshot -> move the
// period to pending_approval. That makes a re-run (after a UC-004
// rejection) idempotent — it can never double-count or half-finish.
//
// Money: integer cents everywhere. Hours and multipliers come out of
// NUMERIC columns as strings, so they're converted to integer hundredths
// before any maths — the only floats ever touched are exact /100 scaling.
// Rounding: half-up at the cent (Math.round) at each pay component
// (regular, OT, PH, each incentive rule); CPF has its own official
// rounding inside statutoryEngine.
//
// Shared tables (pay_period, staff, timesheet) are read with raw SQL
// through the SAME Sequelize connection/transaction, so UC-003 never
// defines models for tables it doesn't own.

const { Op, QueryTypes } = require('sequelize');
const {
  sequelize,
  PayrollLine,
  PayRate,
  IncentiveScheme,
  PerformanceInput,
} = require('../models');
const statutoryEngine = require('./statutoryEngine');
const incentiveEngine = require('./incentiveEngine');
const auditService = require('./auditService');

// Warning flow 5a: if the period's derived gross total differs from the
// previous period's by more than this fraction, the run still completes but
// returns varianceWarning: true and writes an audit entry. Team-tunable.
const VARIANCE_THRESHOLD = 0.2; // 20%

// NUMERIC(6,2) hours arrive as strings like "10.50" — turn them into
// integer hundredths-of-an-hour so all later maths is integer-exact.
function toHundredths(numericString) {
  return Math.round(Number(numericString || 0) * 100);
}

// hours (hundredths) x rate (cents) x multiplier (hundredths, 150 = 1.5x),
// rounded half-up at the cent. Pure integer maths until the final division:
// the two /100 scale factors (hours, multiplier) combine into one /10000.
function payComponentCents(hoursHundredths, rateCents, multiplierHundredths) {
  return Math.round((hoursHundredths * rateCents * multiplierHundredths) / 10000);
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
 * lines, never a stored figure. grossCents includes incentive pay.
 * @param {string} payPeriodId
 * @param {object} [transaction]
 * @returns {Promise<{grossCents: number, deductionsCents: number, netCents: number, completeCount: number}>}
 */
async function derivePeriodTotals(payPeriodId, transaction) {
  const rows = await sequelize.query(
    `SELECT COALESCE(SUM(gross_pay_cents + incentive_cents), 0) AS "grossCents",
            COALESCE(SUM(cpf_employee_cents + sdl_cents + other_deductions_cents), 0) AS "deductionsCents",
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

// Builds one staff member's payroll line. Anything that blocks a correct
// figure (error flows 2a/3a) marks the line incomplete with a human note
// instead of failing the whole run.
function buildLine({ staff, hours, rate, scheme, inputs, period }) {
  const notes = [];
  let grossPayCents = 0;
  let incentiveCents = 0;

  if (staff.employmentType === 'part_time') {
    // No frozen hours is NOT an error — they just didn't work this period.
    if (hours && hours.totalHundredths > 0) {
      if (!rate) {
        notes.push('No pay rate configured — gross pay could not be calculated.');
      } else {
        // total_hours is the whole shift; ot/ph are the classified slices of
        // it, so the plain-rate portion is what's left after removing them.
        const regularHundredths = Math.max(
          hours.totalHundredths - hours.otHundredths - hours.phHundredths,
          0
        );
        grossPayCents =
          payComponentCents(regularHundredths, rate.hourlyRateCents, 100) +
          payComponentCents(hours.otHundredths, rate.hourlyRateCents, rate.otMultiplierHundredths) +
          payComponentCents(hours.phHundredths, rate.hourlyRateCents, rate.phMultiplierHundredths);
      }
    }
  } else {
    // Full-timers are paid incentives from performance inputs, never hours.
    // (Their base salary is handled outside this system in this iteration.)
    if (!scheme) {
      notes.push('No active incentive scheme — incentive could not be calculated.');
    } else {
      const result = incentiveEngine.calculateIncentive({ performanceInputs: inputs, scheme });
      if (result.missingMetrics.length > 0) {
        notes.push(`Missing required performance input(s): ${result.missingMetrics.join(', ')}.`);
      } else {
        incentiveCents = result.incentiveCents;
      }
    }
  }

  // CPF and SDL apply to total wages: hourly gross plus incentives.
  const wageBaseCents = grossPayCents + incentiveCents;

  let cpf = { employeeCents: 0, employerCents: 0 };
  if (staff.cpfEligible && wageBaseCents > 0) {
    if (!staff.dateOfBirth) {
      notes.push('CPF-eligible but no date of birth on file — CPF could not be calculated.');
    } else {
      cpf = statutoryEngine.calculateCpf({
        wageBaseCents,
        // Age band as at the period's end date (see statutoryEngine notes).
        age: statutoryEngine.ageInYears(staff.dateOfBirth, period.endDate),
        cpfEligible: true,
      });
    }
  }

  const sdlCents = statutoryEngine.calculateSdl({ wageBaseCents });
  const otherDeductionsCents = 0; // no deduction source exists in this iteration

  // Net formula from the UC-003 spec: gross + incentive − CPF(employee) −
  // SDL − other deductions. (Flagged to the team: in the real world SDL is
  // an employer levy, not an employee deduction — kept as specified.)
  const netPayCents = wageBaseCents - cpf.employeeCents - sdlCents - otherDeductionsCents;

  return {
    record: {
      payPeriodId: period.id,
      staffId: staff.id,
      grossPayCents,
      incentiveCents,
      cpfEmployeeCents: cpf.employeeCents,
      cpfEmployerCents: cpf.employerCents,
      sdlCents,
      otherDeductionsCents,
      netPayCents,
      lineStatus: notes.length > 0 ? 'incomplete' : 'complete',
      notes: notes.length > 0 ? notes.join(' ') : null,
    },
    display: {
      staffName: staff.fullName,
      externalRef: staff.externalRef,
      employmentType: staff.employmentType,
    },
  };
}

/**
 * Runs the full payroll calculation for a validated pay period.
 * @param {string} payPeriodId
 * @param {string} actor - who triggered the run (for the audit log).
 * @returns {Promise<object>} { error } for the controller's 404/409 cases,
 *   otherwise { data } matching the POST /payroll/calculate response shape.
 */
async function calculatePayroll(payPeriodId, actor) {
  const period = await loadPeriod(payPeriodId);
  if (!period) return { error: 'NOT_FOUND' };
  // 409 guard: only a UC-002-validated period may be calculated. A period
  // that already finished calculating sits at pending_approval, so an
  // accidental second POST lands here and nothing is written — recalculating
  // is only possible after UC-004 rejects the period back to validated.
  if (period.status !== 'validated') {
    return { error: 'NOT_VALIDATED', currentStatus: period.status };
  }

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

    // The frozen UC-002 snapshot: only frozen, matched rows count. Live
    // (unfrozen) roster data is never used — that's the whole point of the
    // snapshot.
    const hourRows = await sequelize.query(
      `SELECT staff_id AS "staffId",
              SUM(total_hours) AS "totalHours",
              SUM(ot_hours) AS "otHours",
              SUM(ph_hours) AS "phHours"
       FROM timesheet
       WHERE pay_period_id = :payPeriodId
         AND is_frozen = true
         AND match_status = 'matched'
         AND staff_id IS NOT NULL
       GROUP BY staff_id`,
      { replacements: { payPeriodId }, type: QueryTypes.SELECT, transaction }
    );
    const hoursByStaff = new Map(
      hourRows.map((row) => [
        row.staffId,
        {
          totalHundredths: toHundredths(row.totalHours),
          otHundredths: toHundredths(row.otHours),
          phHundredths: toHundredths(row.phHours),
        },
      ])
    );

    // Newest rate that was already effective when the period started, per
    // staff member — historic periods recalculate with their historic rate.
    const rateRows = await PayRate.findAll({
      where: { effectiveFrom: { [Op.lte]: period.startDate } },
      order: [['effectiveFrom', 'DESC']],
      transaction,
    });
    const rateByStaff = new Map();
    for (const rate of rateRows) {
      if (!rateByStaff.has(rate.staffId)) {
        rateByStaff.set(rate.staffId, {
          hourlyRateCents: rate.hourlyRateCents,
          otMultiplierHundredths: Math.round(Number(rate.otMultiplier) * 100),
          phMultiplierHundredths: Math.round(Number(rate.phMultiplier) * 100),
        });
      }
    }

    const scheme = await IncentiveScheme.findOne({
      where: { active: true },
      order: [['createdAt', 'DESC']],
      transaction,
    });

    const inputRows = await PerformanceInput.findAll({ where: { payPeriodId }, transaction });
    const inputsByStaff = new Map();
    for (const input of inputRows) {
      if (!inputsByStaff.has(input.staffId)) inputsByStaff.set(input.staffId, []);
      inputsByStaff.get(input.staffId).push(input);
    }

    const lines = staffRows.map((staff) =>
      buildLine({
        staff,
        hours: hoursByStaff.get(staff.id),
        rate: rateByStaff.get(staff.id),
        scheme,
        inputs: inputsByStaff.get(staff.id) || [],
        period,
      })
    );

    await PayrollLine.bulkCreate(
      lines.map((line) => line.record),
      { transaction }
    );

    // Handoff to UC-004: the period now waits for manager review.
    await sequelize.query(
      `UPDATE pay_period SET status = 'pending_approval', updated_at = now() WHERE id = :payPeriodId`,
      { replacements: { payPeriodId }, transaction }
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
      lineCount: built.length,
      incompleteCount: incomplete.length,
      totals,
      varianceWarning,
      statusChange: 'validated -> pending_approval',
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
          notes: line.record.notes,
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
      status: 'pending_approval',
      totals: {
        grossCents: totals.grossCents,
        deductionsCents: totals.deductionsCents,
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
            pl.gross_pay_cents AS "grossPayCents",
            pl.incentive_cents AS "incentiveCents",
            pl.cpf_employee_cents AS "cpfEmployeeCents",
            pl.cpf_employer_cents AS "cpfEmployerCents",
            pl.sdl_cents AS "sdlCents",
            pl.other_deductions_cents AS "otherDeductionsCents",
            pl.net_pay_cents AS "netPayCents",
            pl.line_status AS "lineStatus",
            pl.notes
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
 * @returns {Promise<Array<{id: string, startDate: string, endDate: string, status: string}>>}
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
  payComponentCents, // exported for the rounding unit tests
};
