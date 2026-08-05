const Sequelize = require('sequelize')
const { sequelize } = require('../../../../../API/connection')

// The shared connection pool — never a second one (backend README, Models).
const SampleDepots = sequelize.define(
    'sample_depots',
    {
        name: { type: Sequelize.STRING, allowNull: false, unique: true },
        campaign: { type: Sequelize.STRING, allowNull: true },
        lng: { type: Sequelize.DOUBLE, allowNull: false },
        lat: { type: Sequelize.DOUBLE, allowNull: false },
    },
    { timestamps: true }
)

// sequelize.sync() creates missing tables but never adds a column to an
// existing one, so schema changes live here and are called from onceSynced.
SampleDepots.up = async () => {
    await sequelize.query(
        'ALTER TABLE sample_depots ADD COLUMN IF NOT EXISTS campaign VARCHAR(255)'
    )
}

module.exports = SampleDepots
