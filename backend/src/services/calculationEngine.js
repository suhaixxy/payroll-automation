// UC-003 phase 2: the pure calculation core. One employee in, one fully
// derived payroll line out — no database access, so every rule in guide §5
// is unit-testable in isolation. All statutory numbers come from the rate
// set object built by rateSetService; NOTHING statutory is hardcoded here.
//
// ── MONEY & ROUNDING POLICY (guide §2.4) ────────────────────────────────
// All money is INTEGER CENTS; rates/multipliers are integer BASIS POINTS
// (1 bp = 0.01%). Rounding is HALF-UP AT THE CENT applied at each pay
// component and at each statutory step — never accumulated floats.
// EXCEPTION — CPF uses the CPF Board's own official rounding (source:
// "How much CPF contributions to pay", cpf.gov.sg):
//   1. TOTAL contribution (employer + employee) rounds to the NEAREST
//      DOLLAR (>= 50 cents rounds up);
//   2. the EMPLOYEE share has its cents DROPPED (floored to the dollar);
//   3. the employer share is the difference.
// The guide's blanket "half-up to 2 dp" is overridden here by the official
// rule, which is what an auditor would check against.
//
// ── SDL IS EMPLOYER-BORNE (guide §5.6 critical correction) ──────────────
// SDL is a levy the EMPLOYER pays. It never reduces net pay and never
// appears in employee deductions:
//   net_pay                   = gross_total − cpf_employee
//   employee_deductions_total = cpf_employee
//   employer_cost_total       = cpf_employer + sdl

// Reason codes for incomplete lines (guide §5.8). An incomplete line is
// excluded from period totals and offers a Resolve action in the UI.
const REASON_CODES = Object.freeze({
  MISSING_PAY_RATE: 'MISSING_PAY_RATE',
  MISSING_PERFORMANCE_INPUT: 'MISSING_PERFORMANCE_INPUT',
  NO_HOURS_RECORDED: 'NO_HOURS_RECORDED',
  INVALID_HOURS: 'INVALID_HOURS',
  MISSING_DATE_OF_BIRTH: 'MISSING_DATE_OF_BIRTH', // extra: CPF needs an age band
});

// hours (hundredths of an hour) × rate (cents) × multiplier (basis points),
// rounded half-up at the cent. Integer maths throughout: the three scale
// factors combine into one final /1e6.
function payComponentCents(hoursHundredths, rateCents, multiplierBp) {
  return Math.round((hoursHundredths * rateCents * multiplierBp) / 1e6);
}

// Whole years old on a given date (both 'YYYY-MM-DD' or Date), UTC-safe.
function ageInYears(dateOfBirth, onDate) {
  const dob = new Date(dateOfBirth);
  const ref = new Date(onDate);
  let age = ref.getUTCFullYear() - dob.getUTCFullYear();
  const hadBirthdayThisYear =
    ref.getUTCMonth() > dob.getUTCMonth() ||
    (ref.getUTCMonth() === dob.getUTCMonth() && ref.getUTCDate() >= dob.getUTCDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

function findCpfBand(cpfBands, age) {
  return cpfBands.find(
    (band) => age >= band.ageMin && (band.ageMax === null || age <= band.ageMax)
  );
}

/**
 * CPF for one person for one period, per the official rounding rules above.
 * Below the band's min-wage threshold there is NO employee contribution but
 * the employer still contributes (guide §5.5).
 */
function calculateCpfCents({ wageBaseCents, band, owCeilingCents }) {
  const cappedCents = Math.min(wageBaseCents, owCeilingCents);
  if (cappedCents <= 0) return { employeeCents: 0, employerCents: 0, totalCents: 0 };

  if (cappedCents < band.minWageThresholdCents) {
    const employerCents = Math.round((cappedCents * band.employerRateBp) / 1e6) * 100;
    return { employeeCents: 0, employerCents, totalCents: employerCents };
  }

  const totalCents =
    Math.round((cappedCents * (band.employeeRateBp + band.employerRateBp)) / 1e6) * 100;
  const employeeCents = Math.floor((cappedCents * band.employeeRateBp) / 1e6) * 100;
  return { employeeCents, employerCents: totalCents - employeeCents, totalCents };
}

/**
 * SDL: clamp(min(wage, cap) × rate, min, max) — half-up at the cent.
 * Payable for every employee regardless of CPF eligibility; zero wages =>
 * zero levy.
 */
function calculateSdlCents({ wageBaseCents, rateSet }) {
  if (wageBaseCents <= 0) return 0;
  const cappedCents = Math.min(wageBaseCents, rateSet.sdlWageCapCents);
  const rawCents = Math.round((cappedCents * rateSet.sdlRateBp) / 10000);
  return Math.min(Math.max(rawCents, rateSet.sdlMinCents), rateSet.sdlMaxCents);
}

// ── formatting helpers for the human-readable breakdown ────────────────
const dollars = (cents) => Number((cents / 100).toFixed(2));
const fmtMoney = (cents) => `$${(cents / 100).toFixed(2)}`;
const fmtHours = (hundredths) => (hundredths / 100).toFixed(2);
const fmtMult = (bp) => (bp / 10000).toString();
const fmtPct = (bp) => `${(bp / 100).toString()}%`;

/**
 * Calculates one payroll line (guide §5). Pure function.
 *
 * @param {object} args
 * @param {object} args.staff - { employmentType: 'part_time'|'full_time',
 *   cpfEligible: boolean, dateOfBirth: string|null }
 * @param {Array<{totalHundredths:number, otHundredths:number, phHundredths:number}>} args.hourRows
 *   the frozen per-shift snapshot rows (empty array = no hours recorded).
 * @param {{hourlyRateCents:number}|null} args.rate - the pinned hourly rate.
 * @param {Array<{inputType:string, quantityHundredths:number, unitValueCents:number}>} args.performanceInputs
 * @param {Array<{adjustmentType:string, amountCents:number, cpfApplicable:boolean, reason:string}>} args.adjustments
 *   non-deleted payroll adjustments for this staff+period (§5.4). Amounts
 *   are SIGNED cents — negative reduces pay.
 * @param {object} args.rateSet - from rateSetService (bp/cents form).
 * @param {string} args.periodEndDate - 'YYYY-MM-DD'; age is taken as at this date.
 * @returns {{
 *   regularHundredths:number, otHundredths:number, phHundredths:number,
 *   hourlyRateCents:number|null,
 *   grossFromHoursCents:number, incentiveCents:number, grossTotalCents:number,
 *   cpfEmployeeCents:number, cpfEmployerCents:number, sdlCents:number,
 *   netPayCents:number, employeeDeductionsCents:number, employerCostCents:number,
 *   cpfExempt:boolean, lineStatus:'complete'|'incomplete',
 *   incompleteReasons:Array<{code:string,message:string}>, breakdown:Array<object>
 * }}
 */
function calculateLine({
  staff,
  hourRows = [],
  rate,
  performanceInputs = [],
  adjustments = [],
  rateSet,
  periodEndDate,
}) {
  const reasons = [];
  const breakdown = [];

  let regularHundredths = 0;
  let otHundredths = 0;
  let phHundredths = 0;
  let grossFromHoursCents = 0;
  let incentiveCents = 0;

  if (staff.employmentType === 'part_time') {
    // Validate the snapshot rows before trusting them (guide §2.6): no
    // negative figures, and the OT/PH slices can never exceed the total.
    const invalid = hourRows.some(
      (row) =>
        row.totalHundredths < 0 ||
        row.otHundredths < 0 ||
        row.phHundredths < 0 ||
        row.otHundredths + row.phHundredths > row.totalHundredths
    );
    if (invalid) {
      reasons.push({
        code: REASON_CODES.INVALID_HOURS,
        message: 'Timesheet snapshot contains negative hours or OT/PH exceeding total hours.',
      });
    } else {
      const totalHundredths = hourRows.reduce((sum, row) => sum + row.totalHundredths, 0);
      otHundredths = hourRows.reduce((sum, row) => sum + row.otHundredths, 0);
      phHundredths = hourRows.reduce((sum, row) => sum + row.phHundredths, 0);
      regularHundredths = totalHundredths - otHundredths - phHundredths;

      if (totalHundredths === 0) {
        reasons.push({
          code: REASON_CODES.NO_HOURS_RECORDED,
          message: 'No frozen timesheet hours for this period — confirm in Timesheets whether this is expected.',
        });
      } else if (!rate) {
        reasons.push({
          code: REASON_CODES.MISSING_PAY_RATE,
          message: 'No pay rate configured — gross pay could not be calculated.',
        });
      } else {
        // §5.2 gross from hours — each component rounded half-up at the cent.
        const regularCents = payComponentCents(regularHundredths, rate.hourlyRateCents, 10000);
        const otCents = payComponentCents(otHundredths, rate.hourlyRateCents, rateSet.otMultiplierBp);
        const phCents = payComponentCents(phHundredths, rate.hourlyRateCents, rateSet.phMultiplierBp);
        grossFromHoursCents = regularCents + otCents + phCents;

        breakdown.push({
          label: 'Regular hours',
          detail: `${fmtHours(regularHundredths)} h × ${fmtMoney(rate.hourlyRateCents)}`,
          amount: dollars(regularCents),
        });
        if (otHundredths > 0) {
          breakdown.push({
            label: 'Overtime',
            detail: `${fmtHours(otHundredths)} h × ${fmtMoney(rate.hourlyRateCents)} × ${fmtMult(rateSet.otMultiplierBp)}`,
            amount: dollars(otCents),
          });
        }
        if (phHundredths > 0) {
          breakdown.push({
            label: 'Public holiday',
            detail: `${fmtHours(phHundredths)} h × ${fmtMoney(rate.hourlyRateCents)} × ${fmtMult(rateSet.phMultiplierBp)}`,
            amount: dollars(phCents),
          });
        }
      }
    }
  } else {
    // §5.3 full-timers: incentive = Σ quantity × unit_value over their
    // performance inputs. NO input rows at all is a data problem, not $0.
    if (performanceInputs.length === 0) {
      reasons.push({
        code: REASON_CODES.MISSING_PERFORMANCE_INPUT,
        message: 'Full-timer has no performance input for this period — add one and recalculate.',
      });
    } else {
      for (const input of performanceInputs) {
        const itemCents = Math.round((input.quantityHundredths * input.unitValueCents) / 100);
        incentiveCents += itemCents;
        breakdown.push({
          label: `Incentive — ${input.inputType}`,
          detail: `${fmtHours(input.quantityHundredths)} × ${fmtMoney(input.unitValueCents)}`,
          amount: dollars(itemCents),
        });
      }
    }
  }

  // §5.4: adjustments enter the gross; ONLY cpf_applicable ones enter the
  // CPF wage base, which is therefore computed separately from gross_total.
  let adjustmentsTotalCents = 0;
  let cpfApplicableAdjustmentsCents = 0;
  for (const adjustment of adjustments) {
    adjustmentsTotalCents += adjustment.amountCents;
    if (adjustment.cpfApplicable) cpfApplicableAdjustmentsCents += adjustment.amountCents;
    breakdown.push({
      label: `Adjustment — ${adjustment.adjustmentType}`,
      detail: adjustment.reason || '',
      amount: dollars(adjustment.amountCents),
    });
  }

  const grossTotalCents = grossFromHoursCents + incentiveCents + adjustmentsTotalCents;
  // Clamped at zero: a clawback can push pay negative, but statutory
  // contributions are never computed on a negative wage.
  const cpfWageBaseCents = Math.max(
    0,
    grossFromHoursCents + incentiveCents + cpfApplicableAdjustmentsCents
  );

  breakdown.push({ label: 'Gross total', detail: '', amount: dollars(grossTotalCents), isSubtotal: true });

  // §5.5 CPF
  let cpf = { employeeCents: 0, employerCents: 0, totalCents: 0 };
  const cpfExempt = !staff.cpfEligible;
  if (cpfExempt) {
    // Correct behaviour, NOT a bug (e.g. work-pass holder) — surfaced as a
    // badge in the UI so nobody "fixes" it.
    if (cpfWageBaseCents > 0) {
      breakdown.push({ label: 'CPF', detail: 'CPF-exempt employee — no contributions', amount: 0 });
    }
  } else if (cpfWageBaseCents > 0) {
    if (!staff.dateOfBirth) {
      reasons.push({
        code: REASON_CODES.MISSING_DATE_OF_BIRTH,
        message: 'CPF-eligible but no date of birth on file — CPF could not be calculated.',
      });
    } else {
      const age = ageInYears(staff.dateOfBirth, periodEndDate);
      const band = findCpfBand(rateSet.cpfBands, age);
      cpf = calculateCpfCents({
        wageBaseCents: cpfWageBaseCents,
        band,
        owCeilingCents: rateSet.cpfOwCeilingCents,
      });
      const bandLabel = band.ageMax === null ? `>${band.ageMin - 1}` : `≤${band.ageMax}`;
      breakdown.push({
        label: 'CPF employee',
        detail: `${fmtPct(band.employeeRateBp)} (age ${age}), band ${bandLabel}`,
        amount: -dollars(cpf.employeeCents),
      });
    }
  }

  // §5.6 SDL — employer levy: shown for information, never subtracted from
  // the employee's pay.
  const sdlCents = calculateSdlCents({ wageBaseCents: grossTotalCents, rateSet });

  const netPayCents = grossTotalCents - cpf.employeeCents;
  breakdown.push({ label: 'Net payable', detail: '', amount: dollars(netPayCents), isTotal: true });

  const incomplete = reasons.length > 0;
  return {
    regularHundredths,
    otHundredths,
    phHundredths,
    hourlyRateCents: rate ? rate.hourlyRateCents : null,
    grossFromHoursCents,
    incentiveCents,
    adjustmentsTotalCents,
    grossTotalCents,
    cpfEmployeeCents: cpf.employeeCents,
    cpfEmployerCents: cpf.employerCents,
    sdlCents,
    netPayCents,
    employeeDeductionsCents: cpf.employeeCents,
    employerCostCents: cpf.employerCents + sdlCents,
    cpfExempt,
    lineStatus: incomplete ? 'incomplete' : 'complete',
    incompleteReasons: reasons,
    // Stored even on incomplete lines — a partial derivation helps whoever
    // resolves the line see how far the calculation got.
    breakdown,
  };
}

module.exports = {
  REASON_CODES,
  payComponentCents,
  ageInYears,
  findCpfBand,
  calculateCpfCents,
  calculateSdlCents,
  calculateLine,
};
