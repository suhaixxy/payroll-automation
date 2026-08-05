// UC-003 demo data, seeded at server start (same pattern as
// payPeriodService.ensurePayPeriodsSeeded — idempotent, safe to run every
// boot). Two jobs:
//
// 1. Reference data UC-003 needs: staff birthdates (CPF age bands),
//    two full-timers, one non-CPF-eligible person, pay rates and an
//    incentive scheme. Deliberate gaps for demoing the error flows:
//    S005 has NO pay rate (flow 2a) and S006 is missing a REQUIRED
//    performance input (flow 3a).
//
// 2. One past pay period marked 'validated' with FROZEN timesheet rows —
//    UC-002 (which normally produces the frozen snapshot) isn't built yet,
//    so without this there would be nothing valid to calculate. This block
//    is skipped entirely as soon as any frozen timesheet exists (i.e. once
//    UC-002 is live or the demo was already seeded).

const { pool } = require('../config/database');
const { PayRate, IncentiveScheme, PerformanceInput } = require('../models');
const auditService = require('./auditService');

// Birthdates chosen to land people in different CPF age bands (as of 2026):
// 30, 57, 36, 63, 23, 40 and 27 years old.
const STAFF_DETAILS = [
  { externalRef: 'S001', dateOfBirth: '1996-04-12' },
  { externalRef: 'S002', dateOfBirth: '1968-09-30' }, // >55–60 band
  { externalRef: 'S003', dateOfBirth: '1990-02-20', employmentType: 'full_time' },
  { externalRef: 'S004', dateOfBirth: '1963-05-14' }, // >60–65 band
  { externalRef: 'S005', dateOfBirth: '2002-11-05' }, // no pay rate on purpose (flow 2a)
  { externalRef: 'S006', dateOfBirth: '1985-08-08', employmentType: 'full_time' }, // missing required input (flow 3a)
  { externalRef: 'S007', dateOfBirth: '1999-01-25', cpfEligible: false }, // non-CPF-eligible demo
];

// hourlyRateCents per part-timer. S007's $15.55 exists to demo exact-cents
// rounding (12.1h x $15.55 style cases).
const PAY_RATES = [
  { externalRef: 'S001', hourlyRateCents: 1650 },
  { externalRef: 'S002', hourlyRateCents: 1800 },
  { externalRef: 'S004', hourlyRateCents: 1720 },
  { externalRef: 'S007', hourlyRateCents: 1555 },
];

const DEMO_SCHEME = {
  name: 'FY2026 Full-Timer Incentive',
  ruleDefinition: {
    requiredMetrics: ['sessions'],
    metrics: {
      sessions: { type: 'per_unit', rateCents: 1500 }, // $15 per session delivered
      enrolments: { type: 'per_unit', rateCents: 2500 }, // $25 per enrolment
      sales: { type: 'percentage', basisPoints: 200 }, // 2% of sales (cents)
      kpi: {
        type: 'tiered',
        tiers: [
          { min: 90, bonusCents: 50000 }, // KPI >= 90 → $500
          { min: 80, bonusCents: 25000 }, // KPI >= 80 → $250
        ],
      },
    },
  },
};

// d = days after the period's start date; ot/ph are slices of total.
const DEMO_SHIFTS = [
  { externalRef: 'S001', shifts: [{ d: 0, total: 8 }, { d: 1, total: 8 }, { d: 2, total: 10, ot: 2 }, { d: 3, total: 8 }] },
  { externalRef: 'S002', shifts: [{ d: 0, total: 9 }, { d: 2, total: 9 }, { d: 7, total: 8, ph: 8 }] },
  { externalRef: 'S004', shifts: [{ d: 0, total: 6 }, { d: 1, total: 6 }, { d: 3, total: 6 }, { d: 4, total: 6 }, { d: 8, total: 6 }] },
  { externalRef: 'S005', shifts: [{ d: 1, total: 8 }, { d: 2, total: 8 }] },
  { externalRef: 'S007', shifts: [{ d: 0, total: 7.5 }, { d: 3, total: 7.5 }, { d: 5, total: 7.5 }, { d: 9, total: 7.5 }] },
];

const DEMO_PERFORMANCE_INPUTS = [
  { externalRef: 'S003', metricType: 'sessions', metricValue: 24 },
  { externalRef: 'S003', metricType: 'enrolments', metricValue: 6 },
  { externalRef: 'S003', metricType: 'sales', metricValue: 1250000 }, // $12,500 in cents
  { externalRef: 'S003', metricType: 'kpi', metricValue: 92 },
  // S006 has an enrolments figure but NOT the required 'sessions' one —
  // that's the flow-3a incomplete-line demo.
  { externalRef: 'S006', metricType: 'enrolments', metricValue: 3 },
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
      defaults: { hourlyRateCents: rate.hourlyRateCents, otMultiplier: 1.5, phMultiplier: 2.0 },
    });
  }
}

async function seedIncentiveScheme() {
  await IncentiveScheme.findOrCreate({
    where: { name: DEMO_SCHEME.name },
    defaults: { ruleDefinition: DEMO_SCHEME.ruleDefinition, active: true },
  });
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
           (pay_period_id, staff_id, shift_date, total_hours, ot_hours, ph_hours,
            is_frozen, match_status, match_method)
         VALUES ($1, $2, $3::date + $4::int, $5, $6, $7, true, 'matched', 'id')`,
        [period.id, staffId, period.startDate, shift.d, shift.total, shift.ot || 0, shift.ph || 0]
      );
    }
  }

  for (const input of DEMO_PERFORMANCE_INPUTS) {
    const staffId = idByRef.get(input.externalRef);
    if (!staffId) continue;
    await PerformanceInput.findOrCreate({
      where: { payPeriodId: period.id, staffId, metricType: input.metricType },
      defaults: { metricValue: input.metricValue },
    });
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
  await seedIncentiveScheme();
  await seedDemoValidatedPeriod(idByRef);
}

module.exports = { ensureUc003DemoData };
