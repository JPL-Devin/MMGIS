const Sequelize = require('sequelize')
const { sequelize } = require('../../../../../API/connection')

const FieldAnnotations = sequelize.define(
    'field_annotations',
    {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        mission: { type: Sequelize.STRING, allowNull: false },
        lng: { type: Sequelize.DOUBLE, allowNull: false },
        lat: { type: Sequelize.DOUBLE, allowNull: false },
        note: { type: Sequelize.TEXT, allowNull: false },
        author: { type: Sequelize.STRING, allowNull: true },
    },
    { timestamps: true }
)

// sequelize.sync() creates missing tables but never adds columns to an
// existing one, so schema changes live here and run from onceSynced.
FieldAnnotations.up = async () => {
    await sequelize.query(
        'ALTER TABLE field_annotations ADD COLUMN IF NOT EXISTS author VARCHAR(255)'
    )
}

module.exports = FieldAnnotations
