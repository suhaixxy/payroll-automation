const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL is required. Backend tests refuse to use the normal application database."
  );
}

const databaseName = new URL(testDatabaseUrl).pathname.replace(/^\//, "");
if (!databaseName || databaseName === "payroll_automation") {
  throw new Error(
    "TEST_DATABASE_URL must point to a disposable database, not payroll_automation."
  );
}

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = testDatabaseUrl;
