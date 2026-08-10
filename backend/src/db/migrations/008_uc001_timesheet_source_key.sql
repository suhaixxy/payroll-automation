-- UC-001: stores the original roster identity for manually resolved rows.

ALTER TABLE timesheet ADD COLUMN source_key TEXT;
