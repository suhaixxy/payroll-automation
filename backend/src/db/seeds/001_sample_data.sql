-- UC-001 roster-aligned staff master data. External references and names
-- match the published roster; S999 and S008 are intentionally absent so
-- unmatched-row handling remains demonstrable.
INSERT INTO staff (external_ref, full_name, employment_type, status)
VALUES
  ('S001', 'Andrea Chua', 'full_time', 'active'),
  ('S002', 'Kieron Tan', 'part_time', 'active'),
  ('S003', 'Robert Leon', 'part_time', 'active'),
  ('S004', 'Suhaila Ali', 'part_time', 'active'),
  ('S005', 'Kok En Qi', 'part_time', 'active'),
  ('S006', 'Wei Ming Lim', 'part_time', 'active'),
  ('S007', 'Farah Yusof', 'part_time', 'active')
ON CONFLICT (external_ref) DO UPDATE
SET full_name = EXCLUDED.full_name,
    status = EXCLUDED.status,
    updated_at = now();

-- Sample pay period
INSERT INTO pay_period (start_date, end_date, status)
VALUES ('2026-07-01', '2026-07-15', 'draft')
ON CONFLICT (start_date) DO NOTHING;
