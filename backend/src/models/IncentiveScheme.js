// UC-003: a named set of incentive rules for full-timers. The engine uses
// the newest ACTIVE scheme. rule_definition shape (interpreted by
// services/incentiveEngine.js — all money in INTEGER CENTS):
//
// {
//   requiredMetrics: ['sessions'],            // missing one => line incomplete
//   metrics: {
//     sessions:   { type: 'per_unit',  rateCents: 1500 },
//     enrolments: { type: 'per_unit',  rateCents: 2500 },
//     sales:      { type: 'percentage', basisPoints: 200 },  // 2% of sales cents
//     kpi:        { type: 'tiered', tiers: [{ min: 90, bonusCents: 50000 }] },
//   },
// }

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/sequelize');

const IncentiveScheme = sequelize.define(
  'IncentiveScheme',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    ruleDefinition: { type: DataTypes.JSONB, allowNull: false },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { tableName: 'incentive_scheme' }
);

module.exports = IncentiveScheme;
