// UC-003: one performance figure for one full-timer in one pay period.
// What metric_value means depends on metric_type:
//   sessions / enrolments -> a count
//   sales                 -> a money amount in CENTS (money rule)
//   kpi                   -> a score out of 100

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/sequelize');

const PerformanceInput = sequelize.define(
  'PerformanceInput',
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
    metricType: {
      type: DataTypes.ENUM('sessions', 'enrolments', 'sales', 'kpi'),
      allowNull: false,
    },
    metricValue: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  },
  {
    tableName: 'performance_input',
    indexes: [
      // One value per metric per staff per period — entering it twice is a
      // data-entry mistake, not something the engine should silently sum.
      { unique: true, fields: ['pay_period_id', 'staff_id', 'metric_type'] },
    ],
  }
);

module.exports = PerformanceInput;
