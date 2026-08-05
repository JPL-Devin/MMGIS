const express = require('express')
const router = express.Router()

const { FieldObs } = require('../models/fieldObs')
const { toFeatureCollection } = require('../lib/geojson')

/** Read route: the layer type fetches this. */
router.get('/observations', async (req, res) => {
    try {
        const rows = await FieldObs.findAll({ order: [['id', 'ASC']] })
        res.json(toFeatureCollection(rows.map((r) => r.dataValues || r)))
    } catch (err) {
        res.status(500).json({ status: 'failure', message: `${err}` })
    }
})

/** Write route: the interaction posts an observation here. */
router.post('/observations', async (req, res) => {
    const { note, lng, lat, author, payload } = req.body || {}
    if (typeof note !== 'string' || !note.trim())
        return res
            .status(400)
            .json({ status: 'failure', message: 'note is required' })
    if (!Number.isFinite(Number(lng)) || !Number.isFinite(Number(lat)))
        return res
            .status(400)
            .json({ status: 'failure', message: 'lng and lat are required' })

    try {
        const row = await FieldObs.create({
            note: note.trim(),
            lng: Number(lng),
            lat: Number(lat),
            author: typeof author === 'string' ? author : null,
            payload: payload && typeof payload === 'object' ? payload : null,
        })
        res.json({ status: 'success', body: { id: row.id } })
    } catch (err) {
        res.status(500).json({ status: 'failure', message: `${err}` })
    }
})

module.exports = router
