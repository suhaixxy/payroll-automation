module.exports = (sequelize, DataTypes) => sequelize.define("Approval", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    pay_period_id: { type: DataTypes.UUID, allowNull: false },
    decision: { type: DataTypes.ENUM("approved", "rejected"), allowNull: false },
    approved_by: { type: DataTypes.STRING(100), allowNull: false },
    comment: { type: DataTypes.TEXT, allowNull: true },
    decided_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
    tableName: "approval",
    underscored: true,
    timestamps: true,
    updatedAt: false,
});
