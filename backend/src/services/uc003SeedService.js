// UC-003 demo data, seeded at server start (idempotent, safe to run every
// boot). Two jobs:
//
// 1. Reference data UC-003 needs on the shared staff rows: birthdates (CPF
//    age bands), one full-timer flip, and hourly pay rates for the
//    part-timers. S003 stays WITHOUT a performance input on purpose — that
//    is the missing-input incomplete-line demo (resolve loop, guide §5.8).
//    S001's performance input comes from db/seeds/030_uc003_seed.sql.
//
// 2. One past pay period marked 'validated' with FROZEN timesheet rows —
//    UC-002 (which normally produces the frozen snapshot) isn't built yet,
//    so without this there would be nothing valid to calculate. This block
//    is skipped entirely as soon as any frozen timesheet exists (i.e. once
//    UC-002 is live or the demo was already seeded).

const { pool } = require('../config/database');
const { PayRate } = require('../models');
const auditService = require('./auditService');

// Birthdates chosen to land people in different CPF age bands (as of 2026).
// S004+ entries only apply if the team adds those staff to the shared seed.
const STAFF_DETAILS = [
  { externalRef: 'S001', dateOfBirth: '1996-04-12', employmentType: 'full_time' },
  { externalRef: 'S002', dateOfBirth: '1968-09-30' }, // >55–60 band
  { externalRef: 'S003', dateOfBirth: '1990-02-20', employmentType: 'full_time' },
];

// hourlyRateCents per part-timer.
const PAY_RATES = [{ externalRef: 'S002', hourlyRateCents: 1800 }];

// d = days after the period's start date (kept for documentation; the
// timesheet table has no per-shift date column in this repo).
const DEMO_SHIFTS = [
  { externalRef: 'S002', shifts: [{ total: 9 }, { total: 9 }, { total: 8, ph: 8 }] },
];

async function staffIdByExternalRef() {
  const { rows } = await pool.query(`SELECT id, external_ref FROM staff`);
  return new Map(rows.map((row) => [row.external_ref, row.id]));
}

async function seedStaffDetails() {
  for (const detail of STAFF_DETAILS) {
    // COALESCE keeps any birthdate someone typed in by hand.
    await pool.query(
      `UPDATE staff SET date_of_birth = COALESCE(date_of_birth, $2) WHERE external_ref = $1`,
      [detail.externalRef, detail.dateOfBirth]
    );
    if (detail.employmentType) {
      await pool.query(`UPDATE staff SET employment_type = $2 WHERE external_ref = $1`, [
        detail.externalRef,
        detail.employmentType,
      ]);
    }
    if (detail.cpfEligible === false) {
      await pool.query(`UPDATE staff SET cpf_eligible = false WHERE external_ref = $1`, [
        detail.externalRef,
      ]);
    }
  }
}

async function seedPayRates(idByRef) {
  for (const rate of PAY_RATES) {
    const staffId = idByRef.get(rate.externalRef);
    if (!staffId) continue;
    await PayRate.findOrCreate({
      where: { staffId, effectiveFrom: '2026-01-01' },
      defaults: { hourlyRateCents: rate.hourlyRateCents },
    });
  }
}

// Fakes UC-002's output once: a past period flipped to 'validated' with
// frozen, matched timesheet rows. Skipped forever after any frozen
// timesheet exists.
async function seedDemoValidatedPeriod(idByRef) {
  const { rows: frozen } = await pool.query(
    `SELECT 1 FROM timesheet WHERE is_frozen = true LIMIT 1`
  );
  if (frozen.length > 0) return;

  const { rows: candidates } = await pool.query(
    `SELECT p.id, to_char(p.start_date, 'YYYY-MM-DD') AS "startDate"
     FROM pay_period p
     WHERE p.end_date < CURRENT_DATE
       AND p.status = 'draft'
       AND NOT EXISTS (SELECT 1 FROM timesheet t WHERE t.pay_period_id = p.id)
     ORDER BY p.start_date
     LIMIT 1`
  );
  const period = candidates[0];
  if (!period) return;

  for (const staffShifts of DEMO_SHIFTS) {
    const staffId = idByRef.get(staffShifts.externalRef);
    if (!staffId) continue;
    for (const shift of staffShifts.shifts) {
      await pool.query(
        `INSERT INTO timesheet
           (pay_period_id, staff_id, total_hours, ot_hours, ph_hours,
            is_frozen, match_status)
         VALUES ($1, $2, $3, $4, $5, true, 'matched')`,
        [period.id, staffId, shift.total, shift.ot || 0, shift.ph || 0]
      );
    }
  }

  await pool.query(
    `UPDATE pay_period SET status = 'validated', validated_at = now() WHERE id = $1`,
    [period.id]
  );

  await auditService.logAction({
    entityType: 'pay_period',
    entityId: period.id,
    action: 'uc003_demo_seeded',
    actor: 'system',
    detail: { reason: 'UC-002 not built yet — seeded a frozen validated period for the UC-003 demo' },
  });
}

async function ensureUc003DemoData() {
  await seedStaffDetails();
  const idByRef = await staffIdByExternalRef();
  await seedPayRates(idByRef);
  await seedDemoValidatedPeriod(idByRef);
}

module.exports = { ensureUc003DemoData };
