const { Pool, types } = require("pg");
const { Sequelize } = require("sequelize");
require("dotenv").config();

// ==========================================================
// PostgreSQL timestamp handling
// ==========================================================
// PostgreSQL TIMESTAMP columns are timestamp-without-time-zone.
// Parse them consistently as UTC when converting to JavaScript Date.
types.setTypeParser(types.builtins.TIMESTAMP, (value) => (
  value === null ? null : new Date(`${value.replace(" ", "T")}Z`)
));

// ==========================================================
// Shared pg Pool
// Used by the existing group backend / SQL migration utilities
// ==========================================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});

// ==========================================================
// Sequelize
// Used by UC-005 models and payment workflow
// ==========================================================

const commonOptions = {
  dialect: "postgres",
  logging: false,
  dialectOptions:
    process.env.NODE_ENV === "production"
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : {},
};

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, commonOptions)
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        ...commonOptions,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
      }
    );

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("PostgreSQL Connected");
  } catch (error) {
    console.error("Unable to connect to PostgreSQL:", error.message);
    throw error;
  }
};

module.exports = {
  pool,
  sequelize,
  connectDB,
};