/**
 * FleetState — persistent live state for a rover fleet.
 *
 * `sequelize.sync()` creates a missing table but never alters an existing one,
 * so every schema change after the first release goes in `up()`, which
 * `plugin.js` calls from `onceSynced`. Core does not await it.
 */
const Sequelize = require('sequelize')
const { sequelize } = require('../../../../../API/connection')
const logger = require('../../../../../API/logger')

const attributes = {
    rover: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    lng: {
        type: Sequelize.FLOAT,
        allowNull: false,
    },
    lat: {
        type: Sequelize.FLOAT,
        allowNull: false,
    },
    // 'nominal' | 'degraded' | 'fault'
    health: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'nominal',
    },
    battery: {
        type: Sequelize.FLOAT,
        allowNull: true,
    },
    note: {
        type: Sequelize.TEXT,
        allowNull: true,
    },
}

const options = {
    timestamps: true,
}

const FleetState = sequelize.define('fleet_live_state', attributes, options)

/** Schema changes for an existing installation. Idempotent, always. */
const up = async () => {
    await sequelize
        .query(
            `ALTER TABLE fleet_live_state ADD COLUMN IF NOT EXISTS note text NULL;`
        )
        .catch((err) => {
            logger(
                'error',
                'Failed to add fleet_live_state.note. DB tables may be out of sync!',
                'fleet_live_state',
                null,
                err
            )
        })
}

module.exports = { FleetState, up }
