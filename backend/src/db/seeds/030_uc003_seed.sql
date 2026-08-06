-- UC-003 seed (guide §4.1): inserts ONLY into UC-003-owned tables (plus one
-- disabled system account, see below). References the staff and pay period
-- that 001_sample_data.sql created — never creates staff or periods.
--
-- Edge-case coverage with the THREE staff that exist (S001–S003):
--   S003 Chandra Rao  — CPF-exempt (cpf_eligible = false in 001)
--   S001 Alice Tan    — positive, CPF-applicable adjustment (bonus)
--   S002 Ben Lim      — negative, non-CPF adjustment (deduction)
--   S003               — full-timer with NO performance_inputs row
--                        (missing-input incomplete case once the engine
--                        reads this table)
-- Not coverable until the team adds staff/periods to 001_sample_data.sql
-- (flagged in the build report): an hourly part-timer with NO pay rate, and
-- a PREVIOUS completed period for the variance comparison.

-- A disabled system account so seeded rows can satisfy the NOT NULL
-- created_by/actor FKs. The password is not a bcrypt hash, so nobody can
-- ever log in with it.
INSERT INTO users (id, name, email, password, role)
VALUES ('00000000-0000-4000-8000-000000000001', 'System (seed)', 'system@payroll.local', '!disabled!', 'manager')
ON CONFLICT (email) DO NOTHING;

-- ── Statutory rate set ──────────────────────────────────────────────────
-- ALL FIGURES VERIFIED (phase 6.4, checked 2026-08-06):
-- * CPF rates + $8,000 OW ceiling: CPF Board, "CPF Contribution Rate Table
--   from 1 January 2026" — cpf.gov.sg/employer/employer-obligations/
--   how-much-cpf-contributions-to-pay (see also config/statutory.js).
-- * SDL 0.25% on the first $4,500, min $2.00 / max $11.25: SkillsFuture SG
--   via cpf.gov.sg/employer/employer-obligations/skills-development-levy.
-- * OT 1.5×: Employment Act Part IV — at least 1.5× the basic hourly rate
--   (mom.gov.sg, overtime pay). PH 2.0×: working a public holiday earns an
--   extra day's pay on top of basic pay (mom.gov.sg, public holiday pay).
-- * min_wage_threshold $500: no employee CPF share on total wages <= $500
--   (employer still contributes). DOCUMENTED SIMPLIFICATION: the official
--   $500–$750 phased-in employee rates are out of scope — full rates apply
--   from $500 (cpf.gov.sg, "How much CPF contributions to pay").
INSERT INTO statutory_rate_sets
  (id, version_label, effective_from, effective_to,
   sdl_rate, sdl_min, sdl_max, sdl_wage_cap,
   ot_multiplier, ph_multiplier, cpf_ow_ceiling, created_by)
VALUES
  ('00000000-0000-4000-8000-0000000000a1'::uuid, '2026-01', DATE '2026-01-01', NULL,
   0.0025, 2.00, 11.25, 4500.00,
   1.5000, 2.0000, 8000.00, '00000000-0000-4000-8000-000000000001');

-- CPF age bands (Singapore Citizen / 3rd-year+ PR full rates, 1 Jan 2026).
-- Rates are fractions: 0.2000 = 20%.
INSERT INTO cpf_rate_bands
  (rate_set_id, age_min, age_max, employee_rate, employer_rate, min_wage_threshold)
VALUES
  ('00000000-0000-4000-8000-0000000000a1'::uuid,  0,   55, 0.2000, 0.1700, 500.00),
  ('00000000-0000-4000-8000-0000000000a1'::uuid, 56,   60, 0.1800, 0.1600, 500.00),
  ('00000000-0000-4000-8000-0000000000a1'::uuid, 61,   65, 0.1250, 0.1250, 500.00),
  ('00000000-0000-4000-8000-0000000000a1'::uuid, 66,   70, 0.0750, 0.0900, 500.00),
  ('00000000-0000-4000-8000-0000000000a1'::uuid, 71, NULL, 0.0500, 0.0750, 500.00);

-- ── Adjustments on the seeded 2026-07 period ────────────────────────────
INSERT INTO payroll_adjustments
  (staff_id, period_id, adjustment_type, amount, cpf_applicable, reason, created_by)
VALUES
  ((SELECT id FROM staff WHERE external_ref = 'S001'),
   (SELECT id FROM pay_period WHERE start_date = DATE '2026-07-01' LIMIT 1),
   'bonus', 200.00, true,
   'Retention bonus agreed for July (seed: positive, CPF-applicable case)',
   '00000000-0000-4000-8000-000000000001'),
  ((SELECT id FROM staff WHERE external_ref = 'S002'),
   (SELECT id FROM pay_period WHERE start_date = DATE '2026-07-01' LIMIT 1),
   'deduction', -50.00, false,
   'Recovery of uniform cost (seed: negative, non-CPF case)',
   '00000000-0000-4000-8000-000000000001');

-- ── Performance inputs (guide model: quantity × unit_value) ─────────────
-- S001 (full-timer) gets an input; S003 (full-timer) deliberately gets NONE.
INSERT INTO performance_inputs
  (staff_id, period_id, input_type, quantity, unit_value, notes, created_by)
VALUES
  ((SELECT id FROM staff WHERE external_ref = 'S001'),
   (SELECT id FROM pay_period WHERE start_date = DATE '2026-07-01' LIMIT 1),
   'sessions', 24.00, 15.00, 'Sessions delivered in July (seed)',
   '00000000-0000-4000-8000-000000000001');
