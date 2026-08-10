-- UC-001: adds optional staff profile and workload details.

ALTER TABLE staff ADD COLUMN department TEXT;
ALTER TABLE staff ADD COLUMN role TEXT;
ALTER TABLE staff ADD COLUMN email TEXT;
ALTER TABLE staff ADD COLUMN phone TEXT;
ALTER TABLE staff ADD COLUMN date_joined DATE;
ALTER TABLE staff ADD COLUMN max_weekly_hours NUMERIC;
