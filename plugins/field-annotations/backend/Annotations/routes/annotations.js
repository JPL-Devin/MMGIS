const express = require('express')
const FieldAnnotations = require('../models/annotations')
const { toFeatureCollection } = require('../lib/geojson')

const router = express.Router()

// GET /api/annotations/list?mission=Test — the layertype's source.fetch
router.get('/list', async (req, res) => {
    try {
        const mission = String(req.query.mission || '')
        const rows = await FieldAnnotations.findAll({
            where: mission ? { mission } : {},
            order: [['createdAt', 'DESC']],
            limit: Math.min(parseInt(req.query.limit, 10) || 1000, 5000),
        })
        res.json(toFeatureCollection(rows.map((r) => r.dataValues ?? r)))
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message })
    }
})

// POST /api/annotations/add {mission, lng, lat, note} — the interaction
router.post('/add', async (req, res) => {
    const { mission, lng, lat, note } = req.body || {}
    if (typeof note !== 'string' || note.trim().length === 0)
        return res
            .status(400)
            .json({ status: 'failure', message: 'note is required' })
    if (isNaN(parseFloat(lng)) || isNaN(parseFloat(lat)))
        return res
            .status(400)
            .json({ status: 'failure', message: 'lng and lat are required' })

    try {
        const created = await FieldAnnotations.create({
            mission: String(mission || ''),
            lng: parseFloat(lng),
            lat: parseFloat(lat),
            note: note.trim().slice(0, 4000),
            author: req.user || null,
        })
        res.json({ status: 'success', body: created.dataValues ?? created })
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message })
    }
})

module.exports = router
