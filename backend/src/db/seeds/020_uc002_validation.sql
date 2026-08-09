INSERT INTO timesheet (id,pay_period_id,staff_id,shift_date,clock_in,clock_out,total_hours,ot_hours,ph_hours,is_frozen,match_status,match_method,source_key)
VALUES
 ('b2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','11111111-1111-1111-1111-111111111111','2026-07-16','09:00','17:00',8,0,0,true,'matched','id','S001'),
 ('b2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002','22222222-2222-2222-2222-222222222222','2026-07-17','09:00','18:00',9,1,0,true,'matched','id','S002')
ON CONFLICT (id) DO UPDATE SET total_hours=EXCLUDED.total_hours,ot_hours=EXCLUDED.ot_hours,
 ph_hours=EXCLUDED.ph_hours,is_frozen=true,match_status='matched',updated_at=now();

UPDATE pay_period SET status='validated',validated_at=COALESCE(validated_at,'2026-07-29 09:00:00'),updated_at=now()
WHERE id='a1000000-0000-4000-8000-000000000002';
