// Sequelize instance for the tables UC-003 (and auth) own. The UC-001 code
// talks to Postgres through the pg pool in config/database.js — both read
// the same DATABASE_URL, so they hit the same database. Shared tables that
// came from the SQL migrations (staff, pay_period, timesheet, audit_log)
// stay owned by those migrations; Sequelize only defines the NEW tables.

const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/payroll_automation',
  {
    dialect: 'postgres',
    logging: false,
    // snake_case columns + created_at/updated_at, so the Sequelize-made
    // tables look identical in pgAdmin to the migration-made ones.
    define: { underscored: true },
  }
);

module.exports = { sequelize };
