BEGIN;

INSERT INTO pay_period (id, start_date, end_date, status, total_gross, total_net, is_locked, locked_at, validated_at, created_at, updated_at)
SELECT v.id, m.d + v.off, m.d + v.off + 13, v.status, v.tg, v.tn, v.locked, v.locked_at, now(), now(), now()
FROM (SELECT max(start_date) AS d FROM pay_period) m,
(VALUES
  ('d1d1d1d1-0000-4000-8000-000000000001'::uuid, 14, 'pending_approval', 4000.00, 3917.00, false, NULL::timestamp),
  ('d1d1d1d1-0000-4000-8000-000000000002'::uuid, 28, 'pending_approval', 4100.00, 4016.00, false, NULL::timestamp),
  ('d1d1d1d1-0000-4000-8000-000000000003'::uuid, 42, 'pending_approval', 3950.00, 3869.00, false, NULL::timestamp),
  ('d1d1d1d1-0000-4000-8000-000000000004'::uuid, 56, 'pending_approval', 4200.00, 4114.00, false, NULL::timestamp),
  ('d1d1d1d1-0000-4000-8000-000000000005'::uuid, 70, 'pending_approval', 4050.00, 3968.00, false, NULL::timestamp),
  ('d1d1d1d1-0000-4000-8000-000000000006'::uuid, 84, 'approved',         3900.00, 3820.00, true,  now()),
  ('d1d1d1d1-0000-4000-8000-000000000007'::uuid, 98, 'approved',         4000.00, 3918.00, true,  now()),
  ('d1d1d1d1-0000-4000-8000-000000000008'::uuid,112, 'approved',         4150.00, 4066.00, true,  now())
) AS v(id, off, status, tg, tn, locked, locked_at);

INSERT INTO payroll_line (pay_period_id, staff_id, gross_pay, incentive_pay, cpf_amount, sdl_amount, net_pay, status)
SELECT p.id, s.staff_id, s.gross, s.inc, s.cpf, s.sdl, s.net, 'ok'
FROM (SELECT id FROM pay_period WHERE id::text LIKE 'd1d1d1d1-%') p
CROSS JOIN (VALUES
  ('11111111-1111-1111-1111-111111111111'::uuid, 1200, 100, 120, 10, 1170),
  ('22222222-2222-2222-2222-222222222222'::uuid, 1800, 200, 180, 15, 1805),
  ('33333333-3333-3333-3333-333333333333'::uuid, 1000,  50, 100,  8,  942)
) AS s(staff_id, gross, inc, cpf, sdl, net);

COMMIT;
