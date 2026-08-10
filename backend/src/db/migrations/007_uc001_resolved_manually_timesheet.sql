-- UC-001: preserves manager-resolved timesheet rows across future roster syncs.

ALTER TABLE timesheet ADD COLUMN resolved_manually BOOLEAN DEFAULT false;
