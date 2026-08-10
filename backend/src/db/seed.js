// .env lives at the repo root, one level above backend/.
require("dotenv").config({ path: require("path").resolve(__dirname, "../../../.env") });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { DEFAULT_URL } = require("./waitForDb");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || DEFAULT_URL,
});

async function runSeeds() {
  const seedsDir = path.join(__dirname, "seeds");
  const files = fs
    .readdirSync(seedsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  console.log(`Found ${files.length} seed file(s):`, files);

  for (const file of files) {
    const filePath = path.join(seedsDir, file);
    const sql = fs.readFileSync(filePath, "utf8");
    console.log(`Running seed: ${file}`);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`Seed ${file} failed: ${error.message}`);
    } finally {
      client.release();
    }
    console.log(`Completed: ${file}`);
  }

  console.log("All seeds completed successfully.");
  await pool.end();
}

runSeeds().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
