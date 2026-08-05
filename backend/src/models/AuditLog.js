module.exports = (sequelize, DataTypes) => sequelize.define("AuditLog", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: true },
    user_role: { type: DataTypes.STRING(30), allowNull: true },
    action: { type: DataTypes.STRING(100), allowNull: false },
    entity_type: { type: DataTypes.STRING(100), allowNull: false },
    entity_id: { type: DataTypes.UUID, allowNull: true },
    actor: { type: DataTypes.STRING(100), allowNull: false, defaultValue: "system" },
    ip_address: { type: DataTypes.STRING(64), allowNull: true },
    details: { type: DataTypes.JSONB, allowNull: true },
}, {
    tableName: "audit_log",
    underscored: true,
    timestamps: true,
    updatedAt: false,
});
