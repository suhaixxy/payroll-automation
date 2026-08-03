-- Sample staff
INSERT INTO staff (external_ref, full_name, employment_type, bank_account_no, bank_code, cpf_eligible, status)
VALUES
  ('S001', 'Alice Tan', 'full_time', '1234567890', 'DBS', true, 'active'),
  ('S002', 'Ben Lim', 'part_time', '2345678901', 'OCBC', true, 'active'),
  ('S003', 'Chandra Rao', 'part_time', '3456789012', 'UOB', false, 'active');

-- Sample pay period
INSERT INTO pay_period (start_date, end_date, status)
VALUES
  ('2026-07-01', '2026-07-15', 'draft');