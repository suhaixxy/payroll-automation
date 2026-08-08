const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { Pool } = require("pg");

const connectionString = process.env.VERIFY_DATABASE_URL;

if (!connectionString) {
  throw new Error("Set VERIFY_DATABASE_URL to a separate empty verification database.");
}

const databaseName = new URL(connectionString).pathname.replace(/^\//, "");
if (!databaseName || databaseName === "payroll_automation") {
  throw new Error("Refusing to verify against the application database. Use a separate empty database.");
}

const backendDir = path.resolve(__dirname, "..");
const expectedMigrationCount = fs.readdirSync(path.join(backendDir, "src", "db", "migrations"))
  .filter((file) => file.endsWith(".sql")).length;

function runNode(script) {
  const result = spawnSync(process.execPath, [script], {
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL: connectionString },
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${script} failed with exit code ${result.status}`);
  }
}

async function verify() {
  const pool = new Pool({ connectionString });
  try {
    const existing = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    if (existing.rows[0].count !== 0) {
      throw new Error(`Verification database must be empty; found ${existing.rows[0].count} public table(s).`);
    }
  } finally {
    await pool.end();
  }

  runNode("src/db/migrate.js");
  runNode("src/db/seed.js");

  const verificationPool = new Pool({ connectionString });
  try {
    const migrations = await verificationPool.query("SELECT COUNT(*)::int AS count FROM schema_migrations");
    if (migrations.rows[0].count !== expectedMigrationCount) {
      throw new Error(`Expected ${expectedMigrationCount} migrations, found ${migrations.rows[0].count}.`);
    }

    const requiredTables = [
      "user_account", "staff", "pay_period", "timesheet", "timesheet_exception",
      "calculation_runs", "payroll_lines", "approval", "payment_batch",
      "payment_batch_item", "payslip", "audit_log",
    ];
    const tables = await verificationPool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [requiredTables]
    );
    if (tables.rowCount !== requiredTables.length) {
      const found = new Set(tables.rows.map((row) => row.table_name));
      throw new Error(`Missing required tables: ${requiredTables.filter((table) => !found.has(table)).join(", ")}`);
    }

    const overlaps = await verificationPool.query(`
      SELECT COUNT(*)::int AS count
      FROM pay_period a JOIN pay_period b ON a.id < b.id
       AND a.start_date <= b.end_date AND b.start_date <= a.end_date
    `);
    if (overlaps.rows[0].count !== 0) throw new Error("Seeded pay periods overlap.");

    const invalidApprovals = await verificationPool.query(`
      SELECT COUNT(*)::int AS count
      FROM approval a LEFT JOIN calculation_runs r ON r.id = a.calculation_run_id
      WHERE a.decision = 'approved' AND (r.id IS NULL OR r.period_id <> a.pay_period_id)
    `);
    if (invalidApprovals.rows[0].count !== 0) throw new Error("Approved records are not linked to matching calculation runs.");

    const invalidPayments = await verificationPool.query(`
      SELECT COUNT(*)::int AS count
      FROM payment_batch_item i
      LEFT JOIN payroll_lines l ON l.id = i.payroll_line_id
      LEFT JOIN payment_batch b ON b.id = i.payment_batch_id
      WHERE l.id IS NULL OR b.id IS NULL OR l.run_id <> b.calculation_run_id
    `);
    if (invalidPayments.rows[0].count !== 0) throw new Error("Payment snapshots are not linked to canonical payroll lines.");

    const periodCounts = await verificationPool.query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status = 'draft')::int AS drafts
      FROM pay_period
    `);
    console.log(
      `Fresh database verified: ${migrations.rows[0].count} migrations, ` +
      `${periodCounts.rows[0].total} seeded periods, ${periodCounts.rows[0].drafts} draft period(s).`
    );
  } finally {
    await verificationPool.end();
  }
}

verify().catch((error) => {
  console.error(`Fresh database verification failed: ${error.message}`);
  process.exit(1);
});
