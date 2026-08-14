-- UC-003: allow managers to resolve incomplete payroll lines directly
-- by adding a resolution note and marking them as manually accepted.
-- This lets a manager document why a line is acceptable as-is (e.g.
-- "employee on leave, no hours expected") without changing source data.

ALTER TABLE payroll_lines
  ADD COLUMN IF NOT EXISTS resolved_manually BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolution_note TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
