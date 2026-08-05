const express = require('express')
const router = express.Router()

const SampleDepots = require('../models/depots')
const SampleTubes = require('../models/tubes')

const TUBE_FIELDS = [
    'id',
    'depot_name',
    'name',
    'sample_type',
    'lng',
    'lat',
    'retrieved',
    'retrieved_at',
]

const asNumber = (v) => (v == null || v === '' ? null : Number(v))

router.get('/depots', async (req, res) => {
    try {
        const depots = await SampleDepots.findAll({ order: [['name', 'ASC']] })
        res.send({ status: 'success', depots })
    } catch (err) {
        res.status(500).send({ status: 'failure', message: 'Query failed.' })
    }
})

router.post('/depots/add', async (req, res) => {
    const { name, campaign, lng, lat } = req.body || {}
    if (!name || asNumber(lng) == null || asNumber(lat) == null)
        return res
            .status(400)
            .send({ status: 'failure', message: 'name, lng and lat required.' })
    try {
        const depot = await SampleDepots.create({
            name,
            campaign: campaign || null,
            lng: asNumber(lng),
            lat: asNumber(lat),
        })
        res.send({ status: 'success', depot })
    } catch (err) {
        res.status(500).send({ status: 'failure', message: 'Insert failed.' })
    }
})

// The layer type's source.fetch reads this one.
router.get('/tubes', async (req, res) => {
    const where = req.query.depot ? { depot_name: req.query.depot } : undefined
    try {
        const tubes = await SampleTubes.findAll({
            attributes: TUBE_FIELDS,
            where,
            order: [['id', 'ASC']],
        })
        res.send({ status: 'success', tubes })
    } catch (err) {
        res.status(500).send({ status: 'failure', message: 'Query failed.' })
    }
})

// The interaction's write path: mark an existing tube retrieved.
router.post('/tubes/retrieve', async (req, res) => {
    const id = asNumber((req.body || {}).id)
    if (id == null)
        return res.status(400).send({ status: 'failure', message: 'id required.' })
    try {
        const tube = await SampleTubes.findByPk(id)
        if (tube == null)
            return res
                .status(404)
                .send({ status: 'failure', message: 'No such tube.' })
        await tube.update({ retrieved: true, retrieved_at: new Date() })
        res.send({ status: 'success', tube })
    } catch (err) {
        res.status(500).send({ status: 'failure', message: 'Update failed.' })
    }
})

// The interaction's other write path: drop a new tube where the user clicked.
router.post('/tubes/add', async (req, res) => {
    const { depot_name, name, sample_type, lng, lat } = req.body || {}
    if (!depot_name || asNumber(lng) == null || asNumber(lat) == null)
        return res.status(400).send({
            status: 'failure',
            message: 'depot_name, lng and lat required.',
        })
    try {
        const tube = await SampleTubes.create({
            depot_name,
            name: name || `${depot_name}-${Date.now()}`,
            sample_type: sample_type || null,
            lng: asNumber(lng),
            lat: asNumber(lat),
            retrieved: false,
        })
        res.send({ status: 'success', tube })
    } catch (err) {
        res.status(500).send({ status: 'failure', message: 'Insert failed.' })
    }
})

module.exports = router
