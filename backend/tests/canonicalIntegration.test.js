const bcrypt = require("bcrypt");
const { pool, sequelize } = require("../src/config/database");
const { initializeDatabase } = require("../src/db/initializeDatabase");
const validationService = require("../src/services/validationService");
const approvalService = require("../src/services/approvalService");
const readinessService = require("../src/services/paymentReadinessService");
const paymentService = require("../src/services/paymentFileService");

const ids = {
  user: "94000000-0000-4000-8000-000000000001",
  staff: "94000000-0000-4000-8000-000000000002",
  period: "94000000-0000-4000-8000-000000000003",
  timesheet: "94000000-0000-4000-8000-000000000004",
  rateSet: "94000000-0000-4000-8000-000000000005",
  run: "94000000-0000-4000-8000-000000000006",
  line: "94000000-0000-4000-8000-000000000007",
};
const actor = { id: ids.user, fullName: "Integration Manager", email: "canonical-flow@test.local", role: "manager" };

async function cleanup() {
  await pool.query("DELETE FROM audit_log WHERE user_id=$1 OR entity_id=ANY($2::uuid[])", [ids.user, [ids.period, ids.run]]);
  await pool.query("DELETE FROM payslip WHERE staff_id=$1", [ids.staff]);
  await pool.query("DELETE FROM payment_batch_item WHERE staff_id=$1", [ids.staff]);
  await pool.query("DELETE FROM payment_batch WHERE pay_period_id=$1", [ids.period]);
  await pool.query("DELETE FROM approval WHERE pay_period_id=$1", [ids.period]);
  await pool.query("DELETE FROM payroll_lines WHERE period_id=$1", [ids.period]);
  await pool.query("DELETE FROM calculation_runs WHERE period_id=$1", [ids.period]);
  await pool.query("DELETE FROM cpf_rate_bands WHERE rate_set_id=$1", [ids.rateSet]);
  await pool.query("DELETE FROM statutory_rate_sets WHERE id=$1", [ids.rateSet]);
  await pool.query("DELETE FROM timesheet_exception WHERE pay_period_id=$1", [ids.period]);
  await pool.query("DELETE FROM timesheet WHERE pay_period_id=$1", [ids.period]);
  await pool.query("DELETE FROM pay_period WHERE id=$1", [ids.period]);
  await pool.query("DELETE FROM user_account WHERE id=$1", [ids.user]);
  await pool.query("DELETE FROM staff WHERE id=$1", [ids.staff]);
}

describe("canonical UC-001 to UC-005 handoff", () => {
  beforeAll(async () => { await initializeDatabase(); await cleanup(); });
  afterAll(async () => {
    await cleanup();
    await sequelize.close();
    await pool.end();
  });

  test("frozen timesheet -> canonical run -> locked approval -> payment and payslip", async () => {
    const passwordHash = await bcrypt.hash("Integration123!", 4);
    await pool.query(`INSERT INTO staff
      (id,external_ref,full_name,employment_type,bank_account_no,bank_code,date_of_birth,status)
      VALUES ($1,'T-CANON','Canonical Employee','full_time','123456789','DBS','1990-01-01','active')`, [ids.staff]);
    await pool.query(`INSERT INTO user_account (id,full_name,email,password_hash,role,status)
      VALUES ($1,$2,$3,$4,'manager','active')`, [ids.user, actor.fullName, actor.email, passwordHash]);
    await pool.query(`INSERT INTO pay_period (id,start_date,end_date,status)
      VALUES ($1,'2040-01-01','2040-01-14','draft')`, [ids.period]);
    await pool.query(`INSERT INTO timesheet
      (id,pay_period_id,staff_id,shift_date,total_hours,match_status)
      VALUES ($1,$2,$3,'2040-01-02',8,'matched')`, [ids.timesheet, ids.period, ids.staff]);

    await validationService.markValidated(ids.period, { user: actor, ipAddress: "127.0.0.1" });
    const frozen = await pool.query("SELECT is_frozen FROM timesheet WHERE id=$1", [ids.timesheet]);
    expect(frozen.rows[0].is_frozen).toBe(true);

    await pool.query(`INSERT INTO statutory_rate_sets
      (id,version_label,effective_from,sdl_rate,sdl_min,sdl_max,sdl_wage_cap,ot_multiplier,ph_multiplier,cpf_ow_ceiling,created_by)
      VALUES ($1,'2040-test','2040-01-01',.0025,2,11.25,4500,1.5,2,8000,$2)`, [ids.rateSet, ids.user]);
    await pool.query(`INSERT INTO calculation_runs
      (id,period_id,run_number,rate_set_id,status,total_gross,total_net_payable,lines_complete,lines_incomplete,run_by)
      VALUES ($1,$2,1,$3,'complete',1000,942,1,0,$4)`, [ids.run, ids.period, ids.rateSet, ids.user]);
    await pool.query(`INSERT INTO payroll_lines
      (id,run_id,staff_id,period_id,gross_from_hours,incentive_amount,gross_total,cpf_employee,cpf_employer,sdl,net_pay,line_status)
      VALUES ($1,$2,$3,$4,950,50,1000,50,170,8,942,'complete')`, [ids.line, ids.run, ids.staff, ids.period]);
    await pool.query("UPDATE pay_period SET status='pending_approval' WHERE id=$1", [ids.period]);

    const decision = await approvalService.submitDecision({
      payPeriodId: ids.period, calculationRunId: ids.run, decision: "approved",
    }, actor);
    expect(decision).toMatchObject({ status: "approved", isLocked: true, calculationRunId: ids.run });

    const preview = await readinessService.preview(ids.period);
    expect(preview).toMatchObject({ ready: true, employeeCount: 1, totalAmount: "942.00" });

    const batch = await paymentService.generate({ payPeriodId: ids.period, user: actor, ipAddress: "127.0.0.1" });
    expect(batch).toMatchObject({ status: "completed", hrmsSyncStatus: "completed", employeeCount: 1 });
    const result = await pool.query(`SELECT p.status, COUNT(ps.id)::int AS payslips
      FROM pay_period p LEFT JOIN payment_batch b ON b.pay_period_id=p.id
      LEFT JOIN payslip ps ON ps.payment_batch_id=b.id WHERE p.id=$1 GROUP BY p.status`, [ids.period]);
    expect(result.rows[0]).toMatchObject({ status: "paid", payslips: 1 });
  });
});
