INSERT INTO timesheet (id,pay_period_id,staff_id,shift_date,clock_in,clock_out,total_hours,match_status,match_method,source_key)
VALUES
 ('b1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','11111111-1111-1111-1111-111111111111','2026-07-02','09:00','17:00',8,'matched','id','S001'),
 ('b1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001',NULL,'2026-07-03','09:00','17:00',8,'unmatched',NULL,'S999')
ON CONFLICT (id) DO UPDATE SET staff_id=EXCLUDED.staff_id,total_hours=EXCLUDED.total_hours,
 match_status=EXCLUDED.match_status,updated_at=now();
