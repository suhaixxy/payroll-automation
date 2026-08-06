// UC-003 phase 2.1: loads the statutory rate set (and its CPF age bands)
// that is effective on a given date. The calculation engine reads ALL
// statutory numbers from here — config/statutory.js is no longer consulted.
//
// NUMERIC columns arrive as strings; they are converted ONCE here into
// integer basis points (1 bp = 0.01%) and integer cents, so everything
// downstream is exact integer maths (guide §2.4: money is never a float).

const { pool } = require('../config/database');

// '0.0025' (fraction, NUMERIC(6,4)) -> 25 basis points
function toBasisPoints(fractionString) {
  return Math.round(Number(fractionString) * 10000);
}

// '4500.00' -> 450000 cents
function toCents(moneyString) {
  return Math.round(Number(moneyString) * 100);
}

/**
 * The rate set effective on a date (usually the pay period's end date), or
 * null if none covers it. Newest effective_from wins when several match.
 * @param {string} dateStr - 'YYYY-MM-DD'
 */
async function getRateSetForDate(dateStr) {
  const { rows } = await pool.query(
    `SELECT id, version_label, effective_from, effective_to,
            sdl_rate, sdl_min, sdl_max, sdl_wage_cap,
            ot_multiplier, ph_multiplier, cpf_ow_ceiling
     FROM statutory_rate_sets
     WHERE deleted_at IS NULL
       AND effective_from <= $1
       AND (effective_to IS NULL OR effective_to >= $1)
     ORDER BY effective_from DESC
     LIMIT 1`,
    [dateStr]
  );
  const rateSet = rows[0];
  if (!rateSet) return null;

  const { rows: bandRows } = await pool.query(
    `SELECT age_min, age_max, employee_rate, employer_rate, min_wage_threshold
     FROM cpf_rate_bands
     WHERE rate_set_id = $1
     ORDER BY age_min`,
    [rateSet.id]
  );

  return {
    id: rateSet.id,
    versionLabel: rateSet.version_label,
    sdlRateBp: toBasisPoints(rateSet.sdl_rate),
    sdlMinCents: toCents(rateSet.sdl_min),
    sdlMaxCents: toCents(rateSet.sdl_max),
    sdlWageCapCents: toCents(rateSet.sdl_wage_cap),
    otMultiplierBp: toBasisPoints(rateSet.ot_multiplier),   // 1.5 -> 15000
    phMultiplierBp: toBasisPoints(rateSet.ph_multiplier),   // 2.0 -> 20000
    cpfOwCeilingCents: toCents(rateSet.cpf_ow_ceiling),
    cpfBands: bandRows.map((band) => ({
      ageMin: band.age_min,
      ageMax: band.age_max, // null = no upper bound
      employeeRateBp: toBasisPoints(band.employee_rate),
      employerRateBp: toBasisPoints(band.employer_rate),
      minWageThresholdCents: toCents(band.min_wage_threshold),
    })),
  };
}

module.exports = { getRateSetForDate, toBasisPoints, toCents };
