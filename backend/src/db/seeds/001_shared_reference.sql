-- Canonical identities, staff master, and non-overlapping 14-day periods.
-- Test login account
-- Manager: manager@payroll.local, Password: Manager123!
-- Manager: employee@payroll.local, Password: Employee123!
-- Manager: disabled@payroll.local, Password: Disabled123!

INSERT INTO staff (id, external_ref, full_name, employment_type, bank_account_no, bank_code, cpf_eligible, status, date_of_birth)
VALUES
 ('11111111-1111-1111-1111-111111111111','S001','Andrea Chua','full_time','123456789','DBS',true,'active','1996-04-12'),
 ('22222222-2222-2222-2222-222222222222','S002','Kieron Tan','part_time','223456789','OCBC',true,'active','1968-09-30'),
 ('33333333-3333-3333-3333-333333333333','S003','Robert Leon','full_time','323456789','UOB',false,'active','1990-02-20'),
 ('44444444-4444-4444-4444-444444444444','S004','Suhaila Ali','part_time',NULL,NULL,true,'active','1998-05-10'),
 ('55555555-5555-5555-5555-555555555555','S005','Kok En Qi','part_time','523456789','DBS',true,'active','1997-08-18')
ON CONFLICT (id) DO UPDATE SET external_ref=EXCLUDED.external_ref, full_name=EXCLUDED.full_name,
 employment_type=EXCLUDED.employment_type, bank_account_no=EXCLUDED.bank_account_no,
 bank_code=EXCLUDED.bank_code, cpf_eligible=EXCLUDED.cpf_eligible, status=EXCLUDED.status,
 date_of_birth=EXCLUDED.date_of_birth, updated_at=now();

INSERT INTO user_account (id, full_name, email, password_hash, role, staff_id, status)
VALUES
 ('81000000-0000-0000-0000-000000000002','Payroll Manager','manager@payroll.local','$2b$12$NaG2pTu/3Jw8rHL6WJbH4uYwb0Sj8TR3FHqv7sTj/XQICjwN0VKu6','manager',NULL,'active'),
 ('81000000-0000-0000-0000-000000000003','Andrea Chua','employee@payroll.local','$2b$12$/Vd1SeQFuIpsK2J8.1zOnOwFmKlr3ZtMr6ifhDsj/dDcY7wJrMfhC','employee','11111111-1111-1111-1111-111111111111','active'),
 ('81000000-0000-0000-0000-000000000004','Disabled Demonstration User','disabled@payroll.local','$2b$12$40XtTx/JPTD0364GHZPsg.7yJ14Ftg3y3ZTaM2n3CXPV/YFDbZJmC','employee',NULL,'disabled')
ON CONFLICT (id) DO UPDATE SET full_name=EXCLUDED.full_name, email=EXCLUDED.email,
 password_hash=EXCLUDED.password_hash, role=EXCLUDED.role, staff_id=EXCLUDED.staff_id,
 status=EXCLUDED.status, updated_at=now();

INSERT INTO pay_period (id,start_date,end_date,status,is_locked,locked_at)
VALUES
 ('a1000000-0000-4000-8000-000000000001','2026-07-01','2026-07-14','draft',false,NULL),
 ('a1000000-0000-4000-8000-000000000002','2026-07-15','2026-07-28','validated',false,NULL),
 ('a1000000-0000-4000-8000-000000000003','2026-07-29','2026-08-11','pending_approval',false,NULL),
 ('a1000000-0000-4000-8000-000000000004','2026-08-12','2026-08-25','approved',true,'2026-08-26 09:00:00'),
 ('a1000000-0000-4000-8000-000000000005','2026-06-03','2026-06-16','paid',true,'2026-06-17 09:00:00'),
 ('a1000000-0000-4000-8000-000000000006','2026-06-17','2026-06-30','approved',true,'2026-07-01 09:00:00'),
 ('a1000000-0000-4000-8000-000000000007','2026-05-20','2026-06-02','approved',true,'2026-06-03 09:00:00')
ON CONFLICT (id) DO UPDATE SET start_date=EXCLUDED.start_date,end_date=EXCLUDED.end_date,
 status=EXCLUDED.status,is_locked=EXCLUDED.is_locked,locked_at=EXCLUDED.locked_at,updated_at=now();
