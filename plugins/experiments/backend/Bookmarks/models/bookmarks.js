const Sequelize = require('sequelize')
const { sequelize } = require('../../../../../API/connection')
const logger = require('../../../../../API/logger')

const attributes = {
    mission: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    owner: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    name: {
        type: Sequelize.STRING(256),
        allowNull: false,
    },
    shared: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    // { center: {lat, lng}, zoom, layers: [names], time: {start, end, current}, globe: bool }
    view: {
        type: Sequelize.JSONB,
        allowNull: false,
    },
}

const Bookmarks = sequelize.define('bookmarks', attributes, {
    timestamps: true,
})

const up = async () => {
    await sequelize
        .query(
            `ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS shared boolean NOT NULL DEFAULT false;`
        )
        .catch((err) => {
            logger(
                'error',
                'Failed to add bookmarks.shared. DB tables may be out of sync!',
                'bookmarks',
                null,
                err
            )
        })
}

module.exports = { Bookmarks, up }
