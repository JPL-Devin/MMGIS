const express = require('express')
const { FleetState } = require('../models/fleetState')
const logger = require('../../../../../API/logger')

const router = express.Router()

const asGeoJSON = (rows) => ({
    type: 'FeatureCollection',
    features: rows.map((r) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
        properties: {
            rover: r.rover,
            health: r.health,
            battery: r.battery,
            note: r.note,
            updated: r.updatedAt,
        },
    })),
})

// Read — the layer type's source.fetch calls this.
router.get('/state', async (req, res) => {
    try {
        const rows = await FleetState.findAll({ order: [['rover', 'ASC']] })
        res.send({ status: 'success', body: asGeoJSON(rows) })
    } catch (err) {
        logger('error', 'FleetState read failed', 'fleet_live_state', req, err)
        res.send({ status: 'failure', message: 'Failed to read fleet state.' })
    }
})

// Write — telemetry upsert (also used to seed a demo fleet).
router.post('/report', async (req, res) => {
    const { rover, lng, lat, health, battery } = req.body || {}
    if (typeof rover !== 'string' || rover.length === 0)
        return res.send({ status: 'failure', message: 'rover is required.' })
    if (typeof lng !== 'number' || typeof lat !== 'number')
        return res.send({
            status: 'failure',
            message: 'lng and lat must be numbers.',
        })
    try {
        const existing = await FleetState.findOne({ where: { rover } })
        const values = {
            rover,
            lng,
            lat,
            health: typeof health === 'string' ? health : 'nominal',
            battery: typeof battery === 'number' ? battery : null,
        }
        if (existing) await existing.update(values)
        else await FleetState.create(values)
        res.send({ status: 'success', body: { rover } })
    } catch (err) {
        logger('error', 'FleetState report failed', 'fleet_live_state', req, err)
        res.send({ status: 'failure', message: 'Failed to write fleet state.' })
    }
})

// Write — an operator note attached to one rover.
router.post('/note', async (req, res) => {
    const { rover, note } = req.body || {}
    if (typeof rover !== 'string' || rover.length === 0)
        return res.send({ status: 'failure', message: 'rover is required.' })
    try {
        const existing = await FleetState.findOne({ where: { rover } })
        if (existing == null)
            return res.send({ status: 'failure', message: 'Unknown rover.' })
        await existing.update({ note: note == null ? null : String(note) })
        res.send({ status: 'success', body: { rover, note: existing.note } })
    } catch (err) {
        logger('error', 'FleetState note failed', 'fleet_live_state', req, err)
        res.send({ status: 'failure', message: 'Failed to write note.' })
    }
})

module.exports = router
