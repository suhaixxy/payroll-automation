// UC-003 phase 2.7: unit tests for every business rule in guide §5.
// calculationEngine is pure (no database), so these run standalone.

const {
  REASON_CODES,
  payComponentCents,
  ageInYears,
  calculateCpfCents,
  calculateSdlCents,
  calculateLine,
} = require('../src/services/calculationEngine');

// Mirrors the seeded 2026-01 rate set (030_uc003_seed.sql) in the integer
// basis-point/cents form produced by rateSetService.
const RATE_SET = {
  id: 'rate-set-test',
  versionLabel: 'test-2026-01',
  sdlRateBp: 25, // 0.25%
  sdlMinCents: 200, // $2.00
  sdlMaxCents: 1125, // $11.25
  sdlWageCapCents: 450000, // first $4,500
  otMultiplierBp: 15000, // 1.5x
  phMultiplierBp: 20000, // 2.0x
  cpfOwCeilingCents: 800000, // $8,000
  cpfBands: [
    { ageMin: 0, ageMax: 55, employeeRateBp: 2000, employerRateBp: 1700, minWageThresholdCents: 50000 },
    { ageMin: 56, ageMax: 60, employeeRateBp: 1800, employerRateBp: 1600, minWageThresholdCents: 50000 },
    { ageMin: 61, ageMax: 65, employeeRateBp: 1250, employerRateBp: 1250, minWageThresholdCents: 50000 },
    { ageMin: 66, ageMax: 70, employeeRateBp: 750, employerRateBp: 900, minWageThresholdCents: 50000 },
    { ageMin: 71, ageMax: null, employeeRateBp: 500, employerRateBp: 750, minWageThresholdCents: 50000 },
  ],
};

const PERIOD_END = '2026-07-15';

const partTimer = (overrides = {}) => ({
  employmentType: 'part_time',
  cpfEligible: true,
  dateOfBirth: '1990-01-15', // age 36 at period end -> ≤55 band
  ...overrides,
});

const fullTimer = (overrides = {}) => ({
  employmentType: 'full_time',
  cpfEligible: true,
  dateOfBirth: '1990-01-15',
  ...overrides,
});

const hours = (total, ot = 0, ph = 0) => ({
  totalHundredths: Math.round(total * 100),
  otHundredths: Math.round(ot * 100),
  phHundredths: Math.round(ph * 100),
});

const input = (type, quantity, unitValue) => ({
  inputType: type,
  quantityHundredths: Math.round(quantity * 100),
  unitValueCents: Math.round(unitValue * 100),
});

function calc(args) {
  return calculateLine({ rateSet: RATE_SET, periodEndDate: PERIOD_END, ...args });
}

// ── §5.2 gross from hours ────────────────────────────────────────────────

describe('§5.2 gross from hours (part-timers)', () => {
  test('regular + OT×1.5 + PH×2.0, multipliers from the rate set', () => {
    // 32h regular + 1.5h OT + 8h PH at $18.00
    const line = calc({
      staff: partTimer(),
      rate: { hourlyRateCents: 1800 },
      hourRows: [hours(41.5, 1.5, 8)],
    });
    expect(line.grossFromHoursCents).toBe(57600 + 4050 + 28800); // 576 + 40.50 + 288
    expect(line.regularHundredths).toBe(3200);
    expect(line.lineStatus).toBe('complete');
  });

  test('§2.4 each component rounds half-up at the cent, not at the end', () => {
    // 12.1h × $15.55 = $188.155 -> $188.16 (half-up)
    expect(payComponentCents(1210, 1555, 10000)).toBe(18816);
    // 1.5h OT × $15.55 × 1.5 = $34.9875 -> $34.99
    expect(payComponentCents(150, 1555, 15000)).toBe(3499);
    // exact half-cent boundary rounds UP: 0.1h × $0.05 = $0.005 -> $0.01
    expect(payComponentCents(10, 5, 10000)).toBe(1);
  });
});

// ── §5.3 incentives ──────────────────────────────────────────────────────

describe('§5.3 incentives (full-timers)', () => {
  test('incentive = Σ quantity × unit_value over performance inputs', () => {
    const line = calc({
      staff: fullTimer(),
      performanceInputs: [input('sessions', 24, 15), input('courses', 6, 25)],
    });
    expect(line.incentiveCents).toBe(36000 + 15000); // 360 + 150
    expect(line.grossFromHoursCents).toBe(0); // never paid from hours
    expect(line.lineStatus).toBe('complete');
  });

  test('fractional quantities round half-up per input', () => {
    // 2.5 × $10.01 = $25.025 -> $25.03
    const line = calc({
      staff: fullTimer({ cpfEligible: false }),
      performanceInputs: [input('sessions', 2.5, 10.01)],
    });
    expect(line.incentiveCents).toBe(2503);
  });

  test('full-timer with NO input row is incomplete: MISSING_PERFORMANCE_INPUT', () => {
    const line = calc({ staff: fullTimer(), performanceInputs: [] });
    expect(line.lineStatus).toBe('incomplete');
    expect(line.incompleteReasons.map((reason) => reason.code)).toEqual([
      REASON_CODES.MISSING_PERFORMANCE_INPUT,
    ]);
  });

  test('an input row with quantity 0 is a valid $0 incentive, not missing data', () => {
    const line = calc({ staff: fullTimer(), performanceInputs: [input('sessions', 0, 15)] });
    expect(line.lineStatus).toBe('complete');
    expect(line.incentiveCents).toBe(0);
  });
});

// ── §5.4 adjustments ─────────────────────────────────────────────────────

describe('§5.4 adjustments', () => {
  const bonus = { adjustmentType: 'bonus', amountCents: 20000, cpfApplicable: true, reason: 'Retention bonus' };
  const deduction = { adjustmentType: 'deduction', amountCents: -5000, cpfApplicable: false, reason: 'Uniform cost' };

  test('adjustments enter gross; ONLY cpf_applicable ones enter the CPF wage base', () => {
    // $612 from hours + $200 bonus (CPF) − $50 deduction (non-CPF)
    const line = calc({
      staff: partTimer(), // age 36 -> 20%/17% band
      rate: { hourlyRateCents: 1800 },
      hourRows: [hours(34)],
      adjustments: [bonus, deduction],
    });
    expect(line.adjustmentsTotalCents).toBe(15000); // +200 − 50
    expect(line.grossTotalCents).toBe(61200 + 15000); // 762.00
    // CPF wage base = 612 + 200 (bonus only): employee floor(812 × 20%) = 162,
    // total round(812 × 37% = 300.44) = 300 -> employer 138.
    expect(line.cpfEmployeeCents).toBe(16200);
    expect(line.cpfEmployerCents).toBe(13800);
    expect(line.netPayCents).toBe(76200 - 16200);
    // SDL runs on the FULL gross (762): 1.905 -> 1.91 -> below the $2 floor.
    expect(line.sdlCents).toBe(200);
    expect(line.lineStatus).toBe('complete');
  });

  test('a clawback can push pay negative, but statutory bases clamp at zero', () => {
    const line = calc({
      staff: fullTimer(),
      performanceInputs: [input('sessions', 10, 10)], // $100
      adjustments: [
        { adjustmentType: 'clawback', amountCents: -15000, cpfApplicable: true, reason: 'Overpaid last period' },
      ],
    });
    expect(line.grossTotalCents).toBe(-5000);
    expect(line.cpfEmployeeCents).toBe(0); // wage base clamped at 0
    expect(line.sdlCents).toBe(0); // no levy on negative wages
    expect(line.netPayCents).toBe(-5000);
    expect(line.lineStatus).toBe('complete');
  });

  test('breakdown lists each adjustment with its reason before the gross subtotal', () => {
    const line = calc({
      staff: partTimer(),
      rate: { hourlyRateCents: 1800 },
      hourRows: [hours(34)],
      adjustments: [bonus, deduction],
    });
    const labels = line.breakdown.map((step) => step.label);
    const bonusIndex = labels.indexOf('Adjustment — bonus');
    const grossIndex = labels.indexOf('Gross total');
    expect(bonusIndex).toBeGreaterThan(-1);
    expect(bonusIndex).toBeLessThan(grossIndex);
    expect(line.breakdown[bonusIndex].detail).toBe('Retention bonus');
    expect(line.breakdown[bonusIndex].amount).toBe(200);
    const deductionStep = line.breakdown.find((step) => step.label === 'Adjustment — deduction');
    expect(deductionStep.amount).toBe(-50);
  });
});

// ── §5.5 CPF ─────────────────────────────────────────────────────────────

describe('§5.5 CPF', () => {
  test('age band is taken at the period end date (55/56 boundary)', () => {
    // Turns exactly 55 on period end -> still ≤55 band (20% employee)
    const at55 = calc({
      staff: partTimer({ dateOfBirth: '1971-07-15' }),
      rate: { hourlyRateCents: 1800 },
      hourRows: [hours(34)], // $612 gross
    });
    // 612 × 20% = 122.40 -> employee floors to $122
    expect(at55.cpfEmployeeCents).toBe(12200);

    // Already 56 -> 18% employee band
    const at56 = calc({
      staff: partTimer({ dateOfBirth: '1970-07-01' }),
      rate: { hourlyRateCents: 1800 },
      hourRows: [hours(34)],
    });
    // 612 × 18% = 110.16 -> employee floors to $110;
    // total 612 × 34% = 208.08 -> rounds to $208; employer = 208 − 110 = 98
    expect(at56.cpfEmployeeCents).toBe(11000);
    expect(at56.cpfEmployerCents).toBe(9800);
  });

  test('official CPF Board rounding: total to nearest dollar, employee cents dropped', () => {
    const band = RATE_SET.cpfBands[0]; // 20% / 17%
    const cpf = calculateCpfCents({ wageBaseCents: 81650, band, owCeilingCents: 800000 });
    // total 816.50 × 37% = 302.105 -> $302; employee 816.50 × 20% = 163.30 -> $163
    expect(cpf.totalCents).toBe(30200);
    expect(cpf.employeeCents).toBe(16300);
    expect(cpf.employerCents).toBe(13900);
  });

  test('wage base is capped at the OW ceiling', () => {
    const line = calc({
      staff: partTimer(),
      rate: { hourlyRateCents: 100000 }, // $1,000/h × 10h = $10,000
      hourRows: [hours(10)],
    });
    // capped at $8,000: employee 1,600.00, total 2,960.00, employer 1,360.00
    expect(line.cpfEmployeeCents).toBe(160000);
    expect(line.cpfEmployerCents).toBe(136000);
  });

  test('below the min wage threshold: no employee CPF, employer still pays', () => {
    const line = calc({
      staff: partTimer(),
      rate: { hourlyRateCents: 1000 },
      hourRows: [hours(40)], // $400 < $500 threshold
    });
    expect(line.cpfEmployeeCents).toBe(0);
    // employer 400 × 17% = $68
    expect(line.cpfEmployerCents).toBe(6800);
    expect(line.netPayCents).toBe(40000); // nothing deducted
  });

  test('CPF-exempt staff get 0/0 and stay COMPLETE — correct behaviour, not a bug', () => {
    const line = calc({
      staff: fullTimer({ cpfEligible: false, dateOfBirth: null }),
      performanceInputs: [input('sessions', 24, 15)],
    });
    expect(line.cpfEmployeeCents).toBe(0);
    expect(line.cpfEmployerCents).toBe(0);
    expect(line.cpfExempt).toBe(true);
    expect(line.lineStatus).toBe('complete');
  });

  test('CPF-eligible with no date of birth is incomplete: MISSING_DATE_OF_BIRTH', () => {
    const line = calc({
      staff: fullTimer({ dateOfBirth: null }),
      performanceInputs: [input('sessions', 24, 15)],
    });
    expect(line.lineStatus).toBe('incomplete');
    expect(line.incompleteReasons.map((reason) => reason.code)).toEqual([
      REASON_CODES.MISSING_DATE_OF_BIRTH,
    ]);
  });

  test('ageInYears counts a birthday falling ON the reference date', () => {
    expect(ageInYears('1971-07-15', '2026-07-15')).toBe(55);
    expect(ageInYears('1971-07-16', '2026-07-15')).toBe(54);
    expect(ageInYears('1968-09-30', '2026-07-15')).toBe(57);
  });
});

// ── §5.6 SDL — employer levy, never an employee deduction ────────────────

describe('§5.6 SDL', () => {
  test('0.25% of wages, floor $2.00, cap $11.25 on the first $4,500', () => {
    expect(calculateSdlCents({ wageBaseCents: 126000, rateSet: RATE_SET })).toBe(315); // $3.15
    expect(calculateSdlCents({ wageBaseCents: 61200, rateSet: RATE_SET })).toBe(200); // raw $1.53 -> min
    expect(calculateSdlCents({ wageBaseCents: 1000000, rateSet: RATE_SET })).toBe(1125); // capped
    expect(calculateSdlCents({ wageBaseCents: 0, rateSet: RATE_SET })).toBe(0);
  });

  test('SDL does NOT reduce net pay and is NOT in employee deductions', () => {
    const line = calc({
      staff: partTimer({ dateOfBirth: '1968-09-30' }), // age 57 -> 18%/16%
      rate: { hourlyRateCents: 1800 },
      hourRows: [hours(26, 0, 8)], // $612 gross (18h reg + 8 PH)
    });
    expect(line.sdlCents).toBe(200);
    // net = gross − employee CPF only; SDL absent from the subtraction
    expect(line.netPayCents).toBe(line.grossTotalCents - line.cpfEmployeeCents);
    expect(line.employeeDeductionsCents).toBe(line.cpfEmployeeCents);
    // employer cost carries CPF employer + SDL
    expect(line.employerCostCents).toBe(line.cpfEmployerCents + line.sdlCents);
  });

  test('SDL is payable even for CPF-exempt staff', () => {
    const line = calc({
      staff: fullTimer({ cpfEligible: false }),
      performanceInputs: [input('sessions', 24, 15)], // $360
    });
    expect(line.sdlCents).toBe(200); // raw $0.90 -> min $2
    expect(line.netPayCents).toBe(36000); // untouched by SDL
  });
});

// ── §5.7 calculation breakdown ───────────────────────────────────────────

describe('§5.7 calc_breakdown', () => {
  test('ordered derivation with a gross subtotal and a net total', () => {
    const line = calc({
      staff: partTimer(),
      rate: { hourlyRateCents: 1800 },
      hourRows: [hours(33.5, 1.5)],
    });
    const labels = line.breakdown.map((step) => step.label);
    expect(labels[0]).toBe('Regular hours');
    expect(labels).toContain('Overtime');
    const subtotal = line.breakdown.find((step) => step.isSubtotal);
    const total = line.breakdown.find((step) => step.isTotal);
    expect(subtotal.label).toBe('Gross total');
    expect(subtotal.amount).toBeCloseTo(line.grossTotalCents / 100, 2);
    expect(total.label).toBe('Net payable');
    expect(total.amount).toBeCloseTo(line.netPayCents / 100, 2);
    // the CPF step is shown as a negative amount
    const cpfStep = line.breakdown.find((step) => step.label === 'CPF employee');
    expect(cpfStep.amount).toBeCloseTo(-line.cpfEmployeeCents / 100, 2);
    expect(cpfStep.detail).toMatch(/age 36/);
  });

  test('component amounts sum to the gross subtotal', () => {
    const line = calc({
      staff: partTimer(),
      rate: { hourlyRateCents: 1555 },
      hourRows: [hours(12.1), hours(3, 1.5, 0)],
    });
    const componentSum = line.breakdown
      .filter((step) => !step.isSubtotal && !step.isTotal && step.amount > 0)
      .reduce((sum, step) => sum + Math.round(step.amount * 100), 0);
    expect(componentSum).toBe(line.grossTotalCents);
  });
});

// ── §5.8 incomplete reasons ──────────────────────────────────────────────

describe('§5.8 incomplete lines carry reason codes', () => {
  test('MISSING_PAY_RATE: hours recorded but no rate configured', () => {
    const line = calc({ staff: partTimer(), rate: null, hourRows: [hours(16)] });
    expect(line.lineStatus).toBe('incomplete');
    expect(line.incompleteReasons.map((reason) => reason.code)).toEqual([
      REASON_CODES.MISSING_PAY_RATE,
    ]);
    expect(line.grossTotalCents).toBe(0); // excluded from totals upstream
  });

  test('NO_HOURS_RECORDED: part-timer with an empty frozen snapshot', () => {
    const line = calc({ staff: partTimer(), rate: { hourlyRateCents: 1800 }, hourRows: [] });
    expect(line.lineStatus).toBe('incomplete');
    expect(line.incompleteReasons.map((reason) => reason.code)).toEqual([
      REASON_CODES.NO_HOURS_RECORDED,
    ]);
  });

  test('INVALID_HOURS: OT+PH exceeding total, or negative hours', () => {
    const overSliced = calc({
      staff: partTimer(),
      rate: { hourlyRateCents: 1800 },
      hourRows: [hours(4, 3, 2)], // 3 + 2 > 4
    });
    expect(overSliced.incompleteReasons.map((reason) => reason.code)).toEqual([
      REASON_CODES.INVALID_HOURS,
    ]);

    const negative = calc({
      staff: partTimer(),
      rate: { hourlyRateCents: 1800 },
      hourRows: [hours(-1)],
    });
    expect(negative.lineStatus).toBe('incomplete');
    expect(negative.incompleteReasons[0].code).toBe(REASON_CODES.INVALID_HOURS);
  });

  test('every reason carries a human-readable message', () => {
    const line = calc({ staff: fullTimer(), performanceInputs: [] });
    for (const reason of line.incompleteReasons) {
      expect(typeof reason.message).toBe('string');
      expect(reason.message.length).toBeGreaterThan(10);
    }
  });
});
