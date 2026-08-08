require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT now()
    );
  `);
}

async function getAppliedMigrations() {
  const { rows } = await pool.query("SELECT filename FROM schema_migrations");
  return new Set(rows.map((row) => row.filename));
}

async function runMigrations() {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const migrationsDir = path.join(__dirname, "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const pending = files.filter((file) => !applied.has(file));

  if (pending.length === 0) {
    console.log("No pending migrations. Database is up to date.");
    await pool.end();
    return;
  }

  console.log(`Found ${pending.length} pending migration(s):`, pending);

  for (const file of pending) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf8");
    console.log(`Running migration: ${file}`);
    await pool.query(sql);
    await pool.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
    console.log(`Completed: ${file}`);
  }

  console.log("All migrations completed successfully.");
  await pool.end();
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});