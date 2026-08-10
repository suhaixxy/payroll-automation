-- UC-003: CPF contribution rates depend on the employee's age band, so the
-- payroll calculation needs each staff member's date of birth.
-- Adding this column to the shared staff table was agreed with the group
-- (see UC-003 plan review). Nullable because existing rows won't have it
-- yet — the payroll engine treats a missing date of birth as an incomplete
-- payroll line rather than guessing an age.

ALTER TABLE staff ADD COLUMN date_of_birth DATE;
