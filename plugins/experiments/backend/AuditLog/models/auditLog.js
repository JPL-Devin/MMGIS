const Sequelize = require('sequelize')
const { sequelize } = require('../../../../../API/connection')
const logger = require('../../../../../API/logger')

const attributes = {
    user: { type: Sequelize.STRING, allowNull: true },
    mission: { type: Sequelize.STRING, allowNull: true },
    method: { type: Sequelize.STRING(16), allowNull: false },
    endpoint: { type: Sequelize.STRING(512), allowNull: false },
    action: { type: Sequelize.STRING(128), allowNull: false },
    status: { type: Sequelize.STRING(32), allowNull: true },
    // Compact summary of what changed (request keys, config section diffs, etc.)
    summary: { type: Sequelize.JSONB, allowNull: true },
    ip: { type: Sequelize.STRING(64), allowNull: true },
    duration_ms: { type: Sequelize.INTEGER, allowNull: true },
}

const options = {
    timestamps: true,
    freezeTableName: true,
    createdAt: 'created_on',
    updatedAt: false,
    indexes: [{ fields: ['mission'] }, { fields: ['user'] }, { fields: ['created_on'] }],
}

const AuditLog = sequelize.define('audit_log', attributes, options)

/** Idempotent schema migration for existing installations. */
const up = async () => {
    await sequelize
        .query(`ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS duration_ms integer NULL;`)
        .catch((err) => {
            logger('error', 'Failed to migrate audit_log table.', 'audit_log', null, err)
        })
}

module.exports = { AuditLog, up, sequelize }
