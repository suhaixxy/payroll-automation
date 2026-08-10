-- UC-005 scenarios: one completed batch with payslip, one retryable HRMS
-- failure, one cancelled batch. Period 003 remains eligible for generation;
-- period 004 remains blocked by intentionally missing bank details.
INSERT INTO payment_batch
 (id,pay_period_id,calculation_run_id,batch_reference,file_format,employee_count,total_amount,status,hrms_sync_status,hrms_reference,hrms_error_message,generated_by,generated_at,cancelled_by,cancelled_at,cancellation_reason)
VALUES
 ('c5000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000005','c3500000-0000-4000-8000-000000000005','PAY-20260617090500-COMPLETED','giro',1,1117,'completed','completed','HRMS-DEMO-COMPLETED',NULL,'81000000-0000-0000-0000-000000000002','2026-06-17 09:05:00',NULL,NULL,NULL),
 ('c5000000-0000-4000-8000-000000000006','a1000000-0000-4000-8000-000000000006','c3500000-0000-4000-8000-000000000006','PAY-20260701090500-HRMSFAIL','giro',1,1675,'hrms_sync_failed','failed',NULL,'Mock HRMS synchronisation failed.','81000000-0000-0000-0000-000000000002','2026-07-01 09:05:00',NULL,NULL,NULL),
 ('c5000000-0000-4000-8000-000000000007','a1000000-0000-4000-8000-000000000007','c3500000-0000-4000-8000-000000000007','PAY-20260603090500-CANCELLED','giro',1,942,'cancelled','not_started',NULL,NULL,'81000000-0000-0000-0000-000000000002','2026-06-03 09:05:00','81000000-0000-0000-0000-000000000002','2026-06-03 09:15:00','Demonstration cancellation')
ON CONFLICT (id) DO UPDATE SET calculation_run_id=EXCLUDED.calculation_run_id,
 employee_count=EXCLUDED.employee_count,total_amount=EXCLUDED.total_amount,status=EXCLUDED.status,
 hrms_sync_status=EXCLUDED.hrms_sync_status,hrms_reference=EXCLUDED.hrms_reference,
 hrms_error_message=EXCLUDED.hrms_error_message,cancelled_by=EXCLUDED.cancelled_by,
 cancelled_at=EXCLUDED.cancelled_at,cancellation_reason=EXCLUDED.cancellation_reason,updated_at=now();

INSERT INTO payment_batch_item
 (id,payment_batch_id,payroll_line_id,staff_id,employee_reference,employee_name,bank_code,bank_account_no,gross_pay,incentive_pay,cpf_amount,sdl_amount,other_deduction,net_pay,payment_reference)
VALUES
 ('c5100000-0000-4000-8000-000000000005','c5000000-0000-4000-8000-000000000005','c3600000-0000-4000-8000-000000000051','11111111-1111-1111-1111-111111111111','S001','Andrea Chua','DBS','123456789',1100,100,75,8,0,1117,'PAY-20260617090500-COMPLETED-S001'),
 ('c5100000-0000-4000-8000-000000000006','c5000000-0000-4000-8000-000000000006','c3600000-0000-4000-8000-000000000061','22222222-2222-2222-2222-222222222222','S002','Kieron Tan','OCBC','223456789',1700,100,110,15,0,1675,'PAY-20260701090500-HRMSFAIL-S002'),
 ('c5100000-0000-4000-8000-000000000007','c5000000-0000-4000-8000-000000000007','c3600000-0000-4000-8000-000000000071','33333333-3333-3333-3333-333333333333','S003','Robert Leon','UOB','323456789',950,50,50,8,0,942,'PAY-20260603090500-CANCELLED-S003')
ON CONFLICT (id) DO UPDATE SET payroll_line_id=EXCLUDED.payroll_line_id,net_pay=EXCLUDED.net_pay,updated_at=now();

INSERT INTO payslip
 (id,payment_batch_id,payroll_line_id,staff_id,payslip_reference,company_name,employee_reference,employee_name,pay_period_start,pay_period_end,gross_pay,incentive_pay,cpf_amount,sdl_amount,other_deduction,net_pay,batch_reference,generated_at)
VALUES ('c5200000-0000-4000-8000-000000000005','c5000000-0000-4000-8000-000000000005','c3600000-0000-4000-8000-000000000051','11111111-1111-1111-1111-111111111111','PS-PAY-20260617090500-COMPLETED-S001','Emergencies First Aid & Rescue','S001','Andrea Chua','2026-06-03','2026-06-16',1100,100,75,8,0,1117,'PAY-20260617090500-COMPLETED','2026-06-17 09:08:00')
ON CONFLICT (id) DO UPDATE SET payroll_line_id=EXCLUDED.payroll_line_id,net_pay=EXCLUDED.net_pay,updated_at=now();

INSERT INTO audit_log (id,user_id,user_role,action,entity_type,entity_id,actor,details,created_at)
VALUES
 ('c5300000-0000-4000-8000-000000000005','81000000-0000-0000-0000-000000000002','manager','HRMS_SYNC_SUCCESS','payment_batch','c5000000-0000-4000-8000-000000000005','Payroll Manager','{"scenario":"completed"}','2026-06-17 09:08:00'),
 ('c5300000-0000-4000-8000-000000000006','81000000-0000-0000-0000-000000000002','manager','HRMS_SYNC_FAILURE','payment_batch','c5000000-0000-4000-8000-000000000006','Payroll Manager','{"scenario":"retry"}','2026-07-01 09:08:00'),
 ('c5300000-0000-4000-8000-000000000007','81000000-0000-0000-0000-000000000002','manager','PAYMENT_BATCH_CANCELLED','payment_batch','c5000000-0000-4000-8000-000000000007','Payroll Manager','{"scenario":"cancelled"}','2026-06-03 09:15:00')
ON CONFLICT (id) DO UPDATE SET details=EXCLUDED.details;
