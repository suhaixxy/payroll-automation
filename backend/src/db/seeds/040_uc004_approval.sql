INSERT INTO approval (id,pay_period_id,calculation_run_id,decision,approved_by,comment,decided_at)
VALUES
 ('c4000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000003','c3500000-0000-4000-8000-000000000003','approved','Payroll Manager','Approved integrated end-to-end scenario','2026-08-12 09:00:00'),
 ('c4000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000004','c3500000-0000-4000-8000-000000000004','approved','Payroll Manager','Approved; payment blocked by missing bank details','2026-08-26 09:00:00'),
 ('c4000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000005','c3500000-0000-4000-8000-000000000005','approved','Payroll Manager','Approved completed-payment scenario','2026-06-17 09:00:00'),
 ('c4000000-0000-4000-8000-000000000006','a1000000-0000-4000-8000-000000000006','c3500000-0000-4000-8000-000000000006','approved','Payroll Manager','Approved HRMS retry scenario','2026-07-01 09:00:00'),
 ('c4000000-0000-4000-8000-000000000007','a1000000-0000-4000-8000-000000000007','c3500000-0000-4000-8000-000000000007','approved','Payroll Manager','Approved cancelled-batch scenario','2026-06-03 09:00:00')
ON CONFLICT (id) DO UPDATE SET calculation_run_id=EXCLUDED.calculation_run_id,
 decision=EXCLUDED.decision,approved_by=EXCLUDED.approved_by,comment=EXCLUDED.comment;

UPDATE pay_period p SET status=CASE WHEN p.id='a1000000-0000-4000-8000-000000000005' THEN 'paid' ELSE 'approved' END,
 is_locked=true,locked_at=COALESCE(p.locked_at,a.decided_at),total_gross=r.total_gross,total_net=r.total_net_payable,updated_at=now()
FROM approval a JOIN calculation_runs r ON r.id=a.calculation_run_id
WHERE a.pay_period_id=p.id AND a.decision='approved';
