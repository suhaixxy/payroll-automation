// UC-003: CPF + SDL calculation, isolated here so it can be unit-tested
// without a database and updated safely when rates change. Pure functions:
// data in, cents out. All rates come from config/statutory.js — no
// statutory number may appear in this file.
//
// ── ROUNDING RULES (official, CPF Board "How much CPF contributions to pay",
//    https://www.cpf.gov.sg/employer/employer-obligations/how-much-cpf-contributions-to-pay) ──
// 1. The TOTAL CPF contribution (employer + employee) is rounded to the
//    NEAREST DOLLAR — cents below 50 are dropped, 50 cents and above count
//    as an additional dollar (i.e. half-up at dollar precision).
// 2. The EMPLOYEE's share always has its cents DROPPED (rounded DOWN to a
//    whole dollar).
// 3. The employer's share is the difference: total − employee.
// SDL is kept at exact cent precision (its official max, $11.25, is itself
// a cents value), rounded half-up at the cent (Math.round).
//
// Project simplifications (documented, agreed for this iteration):
// - Wages for a FORTNIGHTLY pay period are checked against the MONTHLY
//   Ordinary Wage ceiling as-is (no pro-rating) — conservative and simple.
// - Everyone gets the standard full rates (Singapore Citizen / 3rd-year+ PR
//   earning > $750/month); graduated PR and low-wage phase-in rates are out
//   of scope.
// - Age is taken in whole years as of the calculation date supplied by the
//   caller (the pay period's end date), not "first day of the month after
//   the birthday month" as the CPF rules state.

const { CPF, SDL } = require('../config/statutory');

/**
 * Whole years old on a given date. Both arguments are 'YYYY-MM-DD' strings
 * (or Date), compared in UTC so this stays timezone-proof.
 * @param {string|Date} dateOfBirth
 * @param {string|Date} onDate
 * @returns {number}
 */
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

function findAgeBand(age) {
  return CPF.ageBands.find((band) => band.maxAge === null || age <= band.maxAge);
}

/**
 * CPF contribution for one person for one pay period.
 * @param {object} args
 * @param {number} args.wageBaseCents - CPF-attracting wages (gross + incentive), integer cents.
 * @param {number} args.age - whole years (see ageInYears).
 * @param {boolean} args.cpfEligible - some staff are not CPF-eligible at all.
 * @returns {{employeeCents: number, employerCents: number, totalCents: number}}
 */
function calculateCpf({ wageBaseCents, age, cpfEligible }) {
  if (!cpfEligible || wageBaseCents <= 0) {
    return { employeeCents: 0, employerCents: 0, totalCents: 0 };
  }

  const band = findAgeBand(age);
  const cappedCents = Math.min(wageBaseCents, CPF.ordinaryWageCeilingCents);

  // Percentages arrive as e.g. 12.5 — scale by 10 so the multiplication is
  // integer maths (12.5% => 125 per-mille) and no float drift sneaks in.
  const employeePerMille = Math.round(band.employeePct * 10);
  const totalPerMille = Math.round((band.employeePct + band.employerPct) * 10);

  // Rule 1: total contribution, rounded to the nearest dollar (half-up).
  const totalCents = Math.round((cappedCents * totalPerMille) / 1000 / 100) * 100;
  // Rule 2: employee share, cents dropped (round DOWN to a whole dollar).
  const employeeCents = Math.floor((cappedCents * employeePerMille) / 1000 / 100) * 100;
  // Rule 3: employer pays the difference.
  const employerCents = totalCents - employeeCents;

  return { employeeCents, employerCents, totalCents };
}

/**
 * Skills Development Levy for one person for one pay period.
 * Payable for every employee regardless of CPF eligibility. Zero wages =>
 * zero levy (nothing was paid out, so there is nothing to levy).
 * @param {object} args
 * @param {number} args.wageBaseCents - total wages, integer cents.
 * @returns {number} levy in integer cents
 */
function calculateSdl({ wageBaseCents }) {
  if (wageBaseCents <= 0) return 0;

  // The levy is computed on the first $4,500 of wages only, which is what
  // makes $11.25 the effective maximum.
  const cappedCents = Math.min(wageBaseCents, SDL.wageCapCents);
  const rawCents = Math.round((cappedCents * SDL.rateBasisPoints) / 10000);

  return Math.min(Math.max(rawCents, SDL.minLevyCents), SDL.maxLevyCents);
}

module.exports = { ageInYears, calculateCpf, calculateSdl };
