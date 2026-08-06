-- UC-003 phase 3: the engine now writes run-scoped payroll_lines (plural)
-- and reads performance_inputs (plural), so the tables ported from the old
-- repo are retired. Their contents were regenerable demo data only:
--   payroll_line      -> superseded by calculation_runs + payroll_lines
--   performance_input -> superseded by performance_inputs (quantity × unit_value)
--   incentive_scheme  -> retired with the scheme-based incentive model (§5.3)
-- pay_rate STAYS — hourly rates are still read from it (ownership pending,
-- guide §3.3).

DROP TABLE IF EXISTS payroll_line;
DROP TABLE IF EXISTS performance_input;
DROP TABLE IF EXISTS incentive_scheme;
