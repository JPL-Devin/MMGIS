/**
 * MapBookmarks routes — CRUD for saved map views.
 *
 *   GET    /api/mapBookmarks/get?mission=<m>   list bookmarks for a mission
 *   POST   /api/mapBookmarks/add               create one { mission,name,lng,lat,zoom,note }
 *   POST   /api/mapBookmarks/remove            delete one { id }
 *
 * All responses are { status: 'success'|'failure', ... } to match the rest of
 * the MMGIS API surface.
 */
const express = require('express')
const router = express.Router()

const MapBookmarks = require('../models/mapBookmarks')
const logger = require('../../../../../API/logger')

router.get('/get', async (req, res) => {
    const mission = req.query.mission
    if (!mission) {
        return res.send({ status: 'failure', message: 'Missing mission.' })
    }
    try {
        const rows = await MapBookmarks.findAll({
            where: { mission },
            order: [['updatedAt', 'DESC']],
        })
        return res.send({ status: 'success', body: rows })
    } catch (err) {
        logger('error', 'Failed to list bookmarks.', 'mapBookmarks', null, err)
        return res.send({ status: 'failure', message: 'Failed to list.' })
    }
})

router.post('/add', async (req, res) => {
    const { mission, name, lng, lat, zoom, note } = req.body || {}
    if (!mission || !name || lng == null || lat == null) {
        return res.send({
            status: 'failure',
            message: 'mission, name, lng and lat are required.',
        })
    }
    try {
        const row = await MapBookmarks.create({
            mission,
            name,
            lng: parseFloat(lng),
            lat: parseFloat(lat),
            zoom: zoom != null ? parseFloat(zoom) : null,
            note: note || null,
        })
        return res.send({ status: 'success', body: row })
    } catch (err) {
        logger('error', 'Failed to add bookmark.', 'mapBookmarks', null, err)
        return res.send({ status: 'failure', message: 'Failed to add.' })
    }
})

router.post('/remove', async (req, res) => {
    const id = (req.body || {}).id
    if (id == null) {
        return res.send({ status: 'failure', message: 'Missing id.' })
    }
    try {
        const count = await MapBookmarks.destroy({ where: { id } })
        return res.send({ status: 'success', body: { removed: count } })
    } catch (err) {
        logger('error', 'Failed to remove bookmark.', 'mapBookmarks', null, err)
        return res.send({ status: 'failure', message: 'Failed to remove.' })
    }
})

module.exports = router
