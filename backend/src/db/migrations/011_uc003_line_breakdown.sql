-- UC-003 phase 2 (guide §5.7 / §5.8): every payroll line stores its ordered
-- human-readable derivation and, when incomplete, structured reason codes
-- [{code, message}] instead of only a free-text note. Added to the ported
-- payroll_line table so the running app benefits now; the columns carry over
-- conceptually to the run-scoped payroll_lines table in phase 3.

ALTER TABLE payroll_line ADD COLUMN IF NOT EXISTS calc_breakdown JSONB;
ALTER TABLE payroll_line ADD COLUMN IF NOT EXISTS incomplete_reasons JSONB;
