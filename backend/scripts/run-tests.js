const crypto = require("crypto");
const path = require("path");
const { spawnSync } = require("child_process");
const { Client } = require("pg");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const backendDir = path.resolve(__dirname, "..");
const protectedDatabase = "payroll_automation";
const generatedPrefix = "payroll_jest_test_";

function databaseName(connectionString) {
  return new URL(connectionString).pathname.replace(/^\//, "");
}

function assertDisposableDatabase(connectionString, expectedName) {
  const name = databaseName(connectionString);
  if (!name || name === protectedDatabase || name !== expectedName || !name.startsWith(generatedPrefix)) {
    throw new Error(`Refusing unsafe test database target: ${name || "<empty>"}`);
  }
}

function adminConnectionString() {
  const source = process.env.TEST_DATABASE_ADMIN_URL
    || process.env.DATABASE_URL
    || "postgresql://postgres:postgres@localhost:5432/payroll_automation";
  const url = new URL(source);
  url.pathname = "/postgres";
  return url.toString();
}

function testConnectionString(adminUrl, name) {
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

function runNode(script, env) {
  const result = spawnSync(process.execPath, [script], {
    cwd: backendDir,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${script} failed with exit code ${result.status ?? "unknown"}`);
  }
}

function runJest(env, args) {
  const jestBin = require.resolve("jest/bin/jest");
  const result = spawnSync(process.execPath, [jestBin, "--runInBand", ...args], {
    cwd: backendDir,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

async function main() {
  const suffix = `${Date.now()}_${process.pid}_${crypto.randomBytes(3).toString("hex")}`;
  const ownedDatabaseName = `${generatedPrefix}${suffix}`;
  const adminUrl = adminConnectionString();
  const testUrl = testConnectionString(adminUrl, ownedDatabaseName);
  assertDisposableDatabase(testUrl, ownedDatabaseName);

  const admin = new Client({ connectionString: adminUrl });
  let created = false;
  let exitCode = 1;

  try {
    try {
      await admin.connect();
    } catch (error) {
      throw new Error(
        `Test database could not be created. Start PostgreSQL/Docker first. (${error.message})`
      );
    }

    await admin.query(`CREATE DATABASE "${ownedDatabaseName}"`);
    created = true;
    console.log(`[test-db] Created disposable database ${ownedDatabaseName}`);

    const childEnv = {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: testUrl,
      TEST_DATABASE_URL: testUrl,
    };

    runNode("src/db/migrate.js", childEnv);
    runNode("src/db/seed.js", childEnv);
    exitCode = runJest(childEnv, process.argv.slice(2));
  } catch (error) {
    console.error(`[test-runner] ${error.message}`);
    exitCode = 1;
  } finally {
    if (created) {
      try {
        assertDisposableDatabase(testUrl, ownedDatabaseName);
        await admin.query(
          `SELECT pg_terminate_backend(pid)
           FROM pg_stat_activity
           WHERE datname = $1 AND pid <> pg_backend_pid()`,
          [ownedDatabaseName]
        );
        await admin.query(`DROP DATABASE "${ownedDatabaseName}"`);
        console.log(`[test-db] Removed disposable database ${ownedDatabaseName}`);
      } catch (error) {
        console.error(`[test-db] Failed to remove ${ownedDatabaseName}: ${error.message}`);
        exitCode = 1;
      }
    }
    await admin.end().catch(() => {});
  }

  process.exitCode = exitCode;
}

main();
