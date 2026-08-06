-- UC-001: adds per-shift detail columns to timesheet, needed for roster
-- sync to store one row per shift (not aggregated), so UC-002 can later
-- check overlaps/caps per date. Also adds 'invalid_time' as a match_status
-- value for rows whose clock-in/out couldn't be read.

ALTER TABLE timesheet ADD COLUMN shift_date DATE;
ALTER TABLE timesheet ADD COLUMN clock_in VARCHAR;
ALTER TABLE timesheet ADD COLUMN clock_out VARCHAR;
ALTER TABLE timesheet ADD COLUMN match_method VARCHAR; -- 'id' | 'name'; null for unmatched/invalid_time rows

ALTER TABLE timesheet DROP CONSTRAINT IF EXISTS timesheet_match_status_check;
ALTER TABLE timesheet ALTER COLUMN match_status TYPE VARCHAR;
ALTER TABLE timesheet ADD CONSTRAINT timesheet_match_status_check
  CHECK (match_status IN ('matched', 'unmatched', 'invalid_time'));