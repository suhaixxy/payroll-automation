// A login account for a system operator (accounting staff or a manager).
// NOT the workforce being paid — that's the staff table. Users log in;
// staff are payroll data and never log in.

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/sequelize');

const User = sequelize.define(
  'User',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    // Always a bcrypt hash — authService is the only place that writes it.
    password: { type: DataTypes.STRING, allowNull: false },
    role: {
      type: DataTypes.ENUM('accounting', 'manager'),
      allowNull: false,
      defaultValue: 'accounting',
    },
  },
  { tableName: 'users' }
);

module.exports = User;
