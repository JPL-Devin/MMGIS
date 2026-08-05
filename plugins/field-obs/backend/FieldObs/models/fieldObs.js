/**
 * FieldObs — field observations stored by the plugin itself.
 */
const Sequelize = require('sequelize')
const { sequelize } = require('../../../../../API/connection')
const logger = require('../../../../../API/logger')

const attributes = {
    note: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    lng: {
        type: Sequelize.DOUBLE,
        allowNull: false,
    },
    lat: {
        type: Sequelize.DOUBLE,
        allowNull: false,
    },
    author: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    payload: {
        type: Sequelize.JSONB,
        allowNull: true,
    },
}

const options = {
    timestamps: true,
}

const FieldObs = sequelize.define('field_obs_observations', attributes, options)

/** Schema changes for an existing installation. Idempotent, always. */
const up = async () => {
    await sequelize
        .query(
            `ALTER TABLE field_obs_observations ADD COLUMN IF NOT EXISTS payload jsonb NULL;`
        )
        .catch((err) => {
            logger(
                'error',
                'Failed to add field_obs_observations.payload. DB tables may be out of sync!',
                'field_obs',
                null,
                err
            )
        })
}

module.exports = { FieldObs, up }
