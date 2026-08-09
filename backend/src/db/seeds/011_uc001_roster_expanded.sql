-- UC-001: expands the staff roster beyond the 5 core team members so the
-- app reflects a realistic headcount, and adds more timesheet history for
-- richer demo data. Additive only — does not modify shared reference data.

INSERT INTO staff (id, external_ref, full_name, employment_type, department, role, email, phone, date_joined, max_weekly_hours, status)
VALUES
  ('66666666-6666-6666-6666-666666666666', 'S006', 'Nur Aisyah Rahman', 'part_time', 'First Aid Training', 'Training Assistant', 'aisyah.rahman@efar.example', '9123 4501', '2025-03-10', 20, 'active'),
  ('77777777-7777-7777-7777-777777777777', 'S007', 'Marcus Tan Wei Jie', 'full_time', 'Emergency Response', 'Response Coordinator', 'marcus.tan@efar.example', '9123 4502', '2024-11-04', NULL, 'active'),
  ('88888888-8888-8888-8888-888888888888', 'S008', 'Priya Devi Krishnan', 'part_time', 'First Aid Training', 'Course Facilitator', 'priya.krishnan@efar.example', '9123 4503', '2025-06-18', 16, 'active'),
  ('99999999-9999-9999-9999-999999999999', 'S009', 'Bryan Ng Kai Loon', 'part_time', 'Logistics', 'Equipment Coordinator', 'bryan.ng@efar.example', '9123 4504', '2025-01-22', 24, 'active'),
  ('a6a6a6a6-a6a6-a6a6-a6a6-a6a6a6a6a6a6', 'S010', 'Farah Nabilah Yusof', 'full_time', 'Emergency Response', 'Senior Responder', 'farah.yusof@efar.example', '9123 4505', '2023-08-01', NULL, 'active'),
  ('b7b7b7b7-b7b7-b7b7-b7b7-b7b7b7b7b7b7', 'S011', 'Daniel Wong Choon Hock', 'part_time', 'Logistics', 'Driver / Equipment Support', 'daniel.wong@efar.example', '9123 4506', '2025-09-15', 12, 'inactive')
ON CONFLICT (id) DO UPDATE SET
  external_ref = EXCLUDED.external_ref, full_name = EXCLUDED.full_name,
  employment_type = EXCLUDED.employment_type, department = EXCLUDED.department,
  role = EXCLUDED.role, email = EXCLUDED.email, phone = EXCLUDED.phone,
  date_joined = EXCLUDED.date_joined, max_weekly_hours = EXCLUDED.max_weekly_hours,
  status = EXCLUDED.status, updated_at = now();

INSERT INTO timesheet (id, pay_period_id, staff_id, shift_date, clock_in, clock_out, total_hours, match_status, match_method, source_key)
VALUES
  ('b1000000-0000-4000-8000-000000000010', 'a1000000-0000-4000-8000-000000000001', '66666666-6666-6666-6666-666666666666', '2026-07-02', '13:00', '17:00', 4, 'matched', 'id', 'S006'),
  ('b1000000-0000-4000-8000-000000000011', 'a1000000-0000-4000-8000-000000000001', '66666666-6666-6666-6666-666666666666', '2026-07-04', '13:00', '17:00', 4, 'matched', 'id', 'S006'),
  ('b1000000-0000-4000-8000-000000000012', 'a1000000-0000-4000-8000-000000000001', '77777777-7777-7777-7777-777777777777', '2026-07-02', '08:30', '17:30', 9, 'matched', 'id', 'S007'),
  ('b1000000-0000-4000-8000-000000000013', 'a1000000-0000-4000-8000-000000000001', '77777777-7777-7777-7777-777777777777', '2026-07-03', '08:30', '17:30', 9, 'matched', 'id', 'S007'),
  ('b1000000-0000-4000-8000-000000000014', 'a1000000-0000-4000-8000-000000000001', '88888888-8888-8888-8888-888888888888', '2026-07-03', '09:00', '13:00', 4, 'matched', 'id', 'S008'),
  ('b1000000-0000-4000-8000-000000000015', 'a1000000-0000-4000-8000-000000000001', '99999999-9999-9999-9999-999999999999', '2026-07-02', '10:00', '18:00', 8, 'matched', 'id', 'S009')
ON CONFLICT (id) DO UPDATE SET staff_id = EXCLUDED.staff_id, total_hours = EXCLUDED.total_hours,
  match_status = EXCLUDED.match_status, updated_at = now();


-- Backfill profile fields for the original 5 team members, whose records
-- were created by the shared seed before these columns existed.
UPDATE staff SET department = 'Emergency Response', role = 'Project Lead', email = 'andrea.chua@efar.example', phone = '9123 4001', date_joined = '2023-01-15', max_weekly_hours = NULL, updated_at = now() WHERE external_ref = 'S001' AND department IS NULL;
UPDATE staff SET department = 'First Aid Training', role = 'Training Coordinator', email = 'kieron.tan@efar.example', phone = '9123 4002', date_joined = '2023-04-02', max_weekly_hours = 20, updated_at = now() WHERE external_ref = 'S002' AND department IS NULL;
UPDATE staff SET department = 'Emergency Response', role = 'Field Supervisor', email = 'robert.leon@efar.example', phone = '9123 4003', date_joined = '2022-11-10', max_weekly_hours = NULL, updated_at = now() WHERE external_ref = 'S003' AND department IS NULL;
UPDATE staff SET department = 'First Aid Training', role = 'Course Facilitator', email = 'suhaila.ali@efar.example', phone = '9123 4004', date_joined = '2024-02-20', max_weekly_hours = 18, updated_at = now() WHERE external_ref = 'S004' AND department IS NULL;
UPDATE staff SET department = 'Logistics', role = 'Operations Assistant', email = 'kok.enqi@efar.example', phone = '9123 4005', date_joined = '2024-06-05', max_weekly_hours = 22, updated_at = now() WHERE external_ref = 'S005' AND department IS NULL;
