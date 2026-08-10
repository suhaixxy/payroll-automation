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

// ── Phase 6: version management (guide §6) ──────────────────────────────
// A rate set is SUPERSEDED by creating a new version, never edited — no
// UPDATE or DELETE exists. Runs pin rate_set_id, so history stays intact.

const { logUc003Action } = require('./uc003AuditService');

const SELECT_RATE_SET = `
  SELECT r.id,
         r.version_label AS "versionLabel",
         to_char(r.effective_from, 'YYYY-MM-DD') AS "effectiveFrom",
         to_char(r.effective_to, 'YYYY-MM-DD') AS "effectiveTo",
         r.sdl_rate AS "sdlRate",
         r.sdl_min AS "sdlMin",
         r.sdl_max AS "sdlMax",
         r.sdl_wage_cap AS "sdlWageCap",
         r.ot_multiplier AS "otMultiplier",
         r.ph_multiplier AS "phMultiplier",
         r.cpf_ow_ceiling AS "cpfOwCeiling",
         COALESCE(u.full_name, 'Legacy user') AS "createdByName",
         to_char(r.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS "createdAt"
  FROM statutory_rate_sets r
  LEFT JOIN user_account u ON u.id = r.created_by
  WHERE r.deleted_at IS NULL`;

async function loadBands(rateSetId) {
  const { rows } = await pool.query(
    `SELECT age_min AS "ageMin", age_max AS "ageMax",
            employee_rate AS "employeeRate", employer_rate AS "employerRate",
            min_wage_threshold AS "minWageThreshold"
     FROM cpf_rate_bands WHERE rate_set_id = $1 ORDER BY age_min`,
    [rateSetId]
  );
  return rows;
}

/** All versions, newest effective_from first; effectiveTo NULL = current. */
async function listRateSets() {
  const { rows } = await pool.query(`${SELECT_RATE_SET} ORDER BY r.effective_from DESC`);
  return { data: { rateSets: rows } };
}

async function getRateSetById(id) {
  const { rows } = await pool.query(`${SELECT_RATE_SET} AND r.id = $1`, [id]);
  if (!rows[0]) return { error: 'RATE_SET_NOT_FOUND' };
  return { data: { ...rows[0], bands: await loadBands(id) } };
}

// Bands must cover every age exactly once: start at 0, each band picks up
// where the previous ended, last band open-ended (age_max NULL).
function validateBandCoverage(bands) {
  if (!bands.length) return 'at least one CPF band is required';
  const sorted = [...bands].sort((a, b) => a.ageMin - b.ageMin);
  if (sorted[0].ageMin !== 0) return 'the first band must start at age 0';
  for (let i = 0; i < sorted.length; i += 1) {
    const band = sorted[i];
    const isLast = i === sorted.length - 1;
    if (isLast) {
      if (band.ageMax !== null && band.ageMax !== undefined) {
        return 'the last band must be open-ended (ageMax null)';
      }
    } else {
      if (band.ageMax === null || band.ageMax === undefined) {
        return 'only the last band may be open-ended';
      }
      if (band.ageMax < band.ageMin) return 'a band has ageMax below ageMin';
      if (sorted[i + 1].ageMin !== band.ageMax + 1) {
        return `bands must be contiguous — expected a band starting at age ${band.ageMax + 1}`;
      }
    }
  }
  return null;
}

/**
 * Creates a new rate set version and closes the currently-open one
 * (effective_to = day before the new effective_from).
 */
async function createRateSet(payload, actor) {
  const bandError = validateBandCoverage(payload.bands);
  if (bandError) return { error: 'INVALID_BANDS', message: bandError };

  const { rows: openRows } = await pool.query(
    `SELECT id, to_char(effective_from, 'YYYY-MM-DD') AS "effectiveFrom"
     FROM statutory_rate_sets
     WHERE deleted_at IS NULL AND effective_to IS NULL
     ORDER BY effective_from DESC LIMIT 1`
  );
  const open = openRows[0];
  if (open && payload.effectiveFrom <= open.effectiveFrom) {
    return { error: 'EFFECTIVE_FROM_NOT_AFTER_CURRENT', currentEffectiveFrom: open.effectiveFrom };
  }

  const client = await pool.connect();
  let createdId;
  try {
    await client.query('BEGIN');
    if (open) {
      await client.query(
        `UPDATE statutory_rate_sets SET effective_to = $1::date - 1 WHERE id = $2`,
        [payload.effectiveFrom, open.id]
      );
    }
    const { rows } = await client.query(
      `INSERT INTO statutory_rate_sets
         (version_label, effective_from, effective_to, sdl_rate, sdl_min, sdl_max,
          sdl_wage_cap, ot_multiplier, ph_multiplier, cpf_ow_ceiling, created_by)
       VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        payload.versionLabel,
        payload.effectiveFrom,
        payload.sdlRate.toFixed(4),
        payload.sdlMin.toFixed(2),
        payload.sdlMax.toFixed(2),
        payload.sdlWageCap.toFixed(2),
        payload.otMultiplier.toFixed(4),
        payload.phMultiplier.toFixed(4),
        payload.cpfOwCeiling.toFixed(2),
        actor.id,
      ]
    );
    createdId = rows[0].id;
    for (const band of payload.bands) {
      await client.query(
        `INSERT INTO cpf_rate_bands
           (rate_set_id, age_min, age_max, employee_rate, employer_rate, min_wage_threshold)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          createdId,
          band.ageMin,
          band.ageMax ?? null,
          band.employeeRate.toFixed(4),
          band.employerRate.toFixed(4),
          band.minWageThreshold.toFixed(2),
        ]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const result = await getRateSetById(createdId);
  await logUc003Action({
    entity: 'statutory_rate_set',
    entityId: createdId,
    action: 'create',
    after: result.data,
    actorId: actor.id,
    actorRole: actor.role,
  });
  return result;
}

module.exports = {
  getRateSetForDate,
  listRateSets,
  getRateSetById,
  createRateSet,
  toBasisPoints,
  toCents,
};
