// Applies the .sql files in db/migrations through the SAME tracked runner
// the server uses at startup (initializeDatabase + schema_migrations), so
// `npm run db:migrate` is idempotent — a second run is a no-op instead of
// crashing on "table already exists".

require("dotenv").config({ path: require("path").resolve(__dirname, "../../../.env") });

const { DEFAULT_URL } = require("./waitForDb");
// config/database.js reads DATABASE_URL at require time, so default it first.
process.env.DATABASE_URL = process.env.DATABASE_URL || DEFAULT_URL;

const { initializeDatabase } = require("./initializeDatabase");
const { pool } = require("../config/database");

initializeDatabase()
  .then(async () => {
    console.log("All migrations applied.");
    await pool.end();
  })
  .catch((err) => {
    console.error(`Migration failed: ${err.message}`);
    if (err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT") {
      console.error("Cannot reach PostgreSQL. Is Docker Desktop running? Try: npm run db:up");
    }
    process.exit(1);
  });
