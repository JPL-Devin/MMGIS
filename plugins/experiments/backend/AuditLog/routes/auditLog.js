const express = require('express')
const router = express.Router()
const { Op } = require('sequelize')

const logger = require('../../../../../API/logger')
const { AuditLog } = require('../models/auditLog')

const MAX_LIMIT = 200

/**
 * GET /api/auditlog/list
 * Query: mission, user, action, endpoint, since (ISO), until (ISO), page (1-based), limit (<=200)
 */
router.get('/list', async function (req, res) {
    try {
        const q = req.query || {}
        const where = {}
        if (q.mission) where.mission = q.mission
        if (q.user) where.user = q.user
        if (q.action) where.action = q.action
        if (q.endpoint) where.endpoint = { [Op.iLike]: `%${q.endpoint}%` }
        if (q.since || q.until) {
            where.created_on = {}
            if (q.since) where.created_on[Op.gte] = new Date(q.since)
            if (q.until) where.created_on[Op.lte] = new Date(q.until)
        }

        const limit = Math.min(Math.max(parseInt(q.limit, 10) || 50, 1), MAX_LIMIT)
        const page = Math.max(parseInt(q.page, 10) || 1, 1)

        const { rows, count } = await AuditLog.findAndCountAll({
            where,
            order: [['created_on', 'DESC']],
            limit,
            offset: (page - 1) * limit,
        })

        res.send({
            status: 'success',
            body: {
                total: count,
                page,
                limit,
                pages: Math.ceil(count / limit),
                entries: rows,
            },
        })
    } catch (err) {
        logger('error', 'Failed to list audit log.', req.originalUrl, req, err)
        res.status(500).send({ status: 'failure', message: 'Failed to list audit log.' })
    }
})

/** GET /api/auditlog/:id */
router.get('/:id', async function (req, res) {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
        res.status(400).send({ status: 'failure', message: 'Invalid id.' })
        return
    }
    try {
        const entry = await AuditLog.findOne({ where: { id } })
        if (!entry) {
            res.status(404).send({ status: 'failure', message: 'Audit entry not found.' })
            return
        }
        res.send({ status: 'success', body: entry })
    } catch (err) {
        logger('error', 'Failed to get audit entry.', req.originalUrl, req, err)
        res.status(500).send({ status: 'failure', message: 'Failed to get audit entry.' })
    }
})

module.exports = router
