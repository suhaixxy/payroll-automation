// Central export for the Sequelize models that exist so far (UC-003 + auth).
// Teammates: require your model here as you build your use case, and it
// will be created by the same startup sync.
//
// The UC-003 run tables (calculation_runs, payroll_lines, performance_inputs,
// statutory_rate_sets, cpf_rate_bands, uc003_audit_log) are migration-owned
// and accessed with raw SQL — they deliberately have no models here.
//
// syncUc003Tables uses PLAIN sequelize.sync(): it only CREATEs tables that
// don't exist yet. Never change it to { force: true } or { alter: true } —
// those can drop or mangle the UC-001 tables and everyone's data.

const { sequelize } = require('../config/sequelize');
const User = require('./User');
const PayRate = require('./PayRate');

async function syncUc003Tables() {
  await sequelize.sync();
}

module.exports = {
  sequelize,
  User,
  PayRate,
  syncUc003Tables,
};
