/**
 * MapBookmarks model — a named, shareable map view.
 *
 * A bookmark stores where the camera was (lng/lat/zoom) plus an optional note,
 * scoped to a mission so different missions keep their own list. Uses the
 * shared API/connection pool (never a second one).
 */
const Sequelize = require('sequelize')
const { sequelize } = require('../../../../../API/connection')

const MapBookmarks = sequelize.define(
    'map_bookmarks',
    {
        mission: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        name: {
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
        zoom: {
            type: Sequelize.FLOAT,
            allowNull: true,
        },
        note: {
            type: Sequelize.TEXT,
            allowNull: true,
        },
    },
    { timestamps: true }
)

// Schema changes go here (sequelize.sync() never alters existing tables).
// Called from plugin.js onceSynced. Idempotent.
MapBookmarks.up = async () => {
    await sequelize.query(
        'ALTER TABLE map_bookmarks ADD COLUMN IF NOT EXISTS note TEXT'
    )
}

module.exports = MapBookmarks
