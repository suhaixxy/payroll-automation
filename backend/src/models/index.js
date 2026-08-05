// Central export for the Sequelize models that exist so far (UC-003 + auth).
// Teammates: require your model here as you build your use case, and it
// will be created by the same startup sync.
//
// syncUc003Tables uses PLAIN sequelize.sync(): it only CREATEs tables that
// don't exist yet. Never change it to { force: true } or { alter: true } —
// those can drop or mangle the UC-001 tables and everyone's data.

const { sequelize } = require('../config/sequelize');
const User = require('./User');
const PayRate = require('./PayRate');
const IncentiveScheme = require('./IncentiveScheme');
const PerformanceInput = require('./PerformanceInput');
const PayrollLine = require('./PayrollLine');

async function syncUc003Tables() {
  await sequelize.sync();
}

module.exports = {
  sequelize,
  User,
  PayRate,
  IncentiveScheme,
  PerformanceInput,
  PayrollLine,
  syncUc003Tables,
};
