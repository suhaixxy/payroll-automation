// UC-003: a part-timer's hourly pay rate, effective from a given date.
// The engine picks the newest rate whose effective_from is on or before the
// pay period's start date, so historic periods recalculate with historic
// rates. Money is INTEGER CENTS (see payrollCalcEngine notes).

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/sequelize');

const PayRate = sequelize.define(
  'PayRate',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    staffId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'staff', key: 'id' },
    },
    hourlyRateCents: { type: DataTypes.INTEGER, allowNull: false },
    // Multipliers are small exact decimals (1.50, 2.00), not money.
    otMultiplier: { type: DataTypes.DECIMAL(4, 2), allowNull: false, defaultValue: 1.5 },
    phMultiplier: { type: DataTypes.DECIMAL(4, 2), allowNull: false, defaultValue: 2.0 },
    effectiveFrom: { type: DataTypes.DATEONLY, allowNull: false },
  },
  {
    tableName: 'pay_rate',
    indexes: [{ fields: ['staff_id', 'effective_from'] }],
  }
);

module.exports = PayRate;
