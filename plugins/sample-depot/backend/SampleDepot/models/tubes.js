const Sequelize = require('sequelize')
const { sequelize } = require('../../../../../API/connection')

const SampleTubes = sequelize.define(
    'sample_tubes',
    {
        depot_name: { type: Sequelize.STRING, allowNull: false },
        name: { type: Sequelize.STRING, allowNull: false },
        sample_type: { type: Sequelize.STRING, allowNull: true },
        lng: { type: Sequelize.DOUBLE, allowNull: false },
        lat: { type: Sequelize.DOUBLE, allowNull: false },
        retrieved: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        retrieved_at: { type: Sequelize.DATE, allowNull: true },
    },
    { timestamps: true }
)

SampleTubes.up = async () => {
    await sequelize.query(
        'ALTER TABLE sample_tubes ADD COLUMN IF NOT EXISTS retrieved_at TIMESTAMP WITH TIME ZONE'
    )
}

module.exports = SampleTubes
