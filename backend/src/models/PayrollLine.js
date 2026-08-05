// UC-003: one staff member's calculated pay for one pay period — the main
// output of the payroll calculation. All money columns are INTEGER CENTS.
// There are no stored period totals anywhere: totals are always derived by
// summing the period's COMPLETE lines, so they can never drift out of sync.

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/sequelize');

const PayrollLine = sequelize.define(
  'PayrollLine',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    payPeriodId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'pay_period', key: 'id' },
    },
    staffId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'staff', key: 'id' },
    },
    grossPayCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    incentiveCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    cpfEmployeeCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    cpfEmployerCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    sdlCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    otherDeductionsCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    netPayCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    // incomplete = something needed for this person's pay was missing (no
    // pay rate, missing required performance input, no date of birth for a
    // CPF-eligible person). Incomplete lines are excluded from period totals.
    lineStatus: {
      type: DataTypes.ENUM('complete', 'incomplete'),
      allowNull: false,
      defaultValue: 'complete',
    },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: 'payroll_line',
    indexes: [
      // Re-running the calculation replaces a period's lines inside one
      // transaction; this constraint makes double-counting impossible even
      // if that logic ever regresses.
      { unique: true, fields: ['pay_period_id', 'staff_id'] },
    ],
  }
);

module.exports = PayrollLine;
