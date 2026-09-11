const express = require('express')
const Sequelize = require('sequelize')
const router = express.Router()

const logger = require('../../../../../API/logger')
const { Bookmarks } = require('../models/bookmarks')

const Op = Sequelize.Op

function fail(res, message, code = 400) {
    res.status(code).send({ status: 'failure', message, body: {} })
}

/**
 * GET /api/bookmarks?mission=<mission>
 * Returns the caller's own bookmarks plus all shared bookmarks in the mission.
 */
router.get('/', (req, res) => {
    const mission = req.query.mission
    if (!mission) return fail(res, 'mission is required.')

    Bookmarks.findAll({
        where: {
            mission,
            [Op.or]: [{ owner: req.user }, { shared: true }],
        },
        order: [['createdAt', 'DESC']],
    })
        .then((rows) => {
            res.send({
                status: 'success',
                body: rows.map((r) => ({
                    id: r.id,
                    mission: r.mission,
                    owner: r.owner,
                    name: r.name,
                    shared: r.shared,
                    view: r.view,
                    createdAt: r.createdAt,
                    isOwner: r.owner === req.user,
                })),
            })
        })
        .catch((err) => {
            logger('error', 'Failed to get bookmarks.', req.originalUrl, req, err)
            fail(res, 'Failed to get bookmarks.', 500)
        })
})

/**
 * POST /api/bookmarks
 * body: { mission, name, shared?, view: { center:{lat,lng}, zoom, layers:[], time:{}, globe } }
 */
router.post('/', (req, res) => {
    const { mission, name, shared, view } = req.body || {}
    if (!mission || typeof mission !== 'string')
        return fail(res, 'mission is required.')
    if (!name || typeof name !== 'string' || name.length > 256)
        return fail(res, 'name is required (max 256 chars).')
    if (
        view == null ||
        typeof view !== 'object' ||
        view.center == null ||
        typeof view.center.lat !== 'number' ||
        typeof view.center.lng !== 'number' ||
        typeof view.zoom !== 'number'
    )
        return fail(res, 'view must include numeric center.lat, center.lng and zoom.')

    const cleanView = {
        center: { lat: view.center.lat, lng: view.center.lng },
        zoom: view.zoom,
        layers: Array.isArray(view.layers)
            ? view.layers.filter((l) => typeof l === 'string').slice(0, 500)
            : [],
        time: view.time && typeof view.time === 'object' ? view.time : null,
        globe: view.globe === true,
    }

    Bookmarks.create({
        mission,
        owner: req.user,
        name,
        shared: shared === true,
        view: cleanView,
    })
        .then((created) => {
            res.send({
                status: 'success',
                message: 'Bookmark saved.',
                body: { id: created.id },
            })
        })
        .catch((err) => {
            logger('error', 'Failed to save bookmark.', req.originalUrl, req, err)
            fail(res, 'Failed to save bookmark.', 500)
        })
})

/**
 * DELETE /api/bookmarks/:id
 * Only the owner may delete.
 */
router.delete('/:id', (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) return fail(res, 'Invalid id.')

    Bookmarks.destroy({ where: { id, owner: req.user } })
        .then((count) => {
            if (count === 0)
                return fail(res, 'Bookmark not found or not owned by you.', 404)
            res.send({ status: 'success', message: 'Bookmark deleted.', body: {} })
        })
        .catch((err) => {
            logger('error', 'Failed to delete bookmark.', req.originalUrl, req, err)
            fail(res, 'Failed to delete bookmark.', 500)
        })
})

module.exports = router
