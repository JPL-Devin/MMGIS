const logger = require('../../../../API/logger')
const { AuditLog } = require('./models/auditLog')

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const MAX_STRING = 200
const MAX_KEYS = 40

function truncate(v) {
    if (typeof v === 'string' && v.length > MAX_STRING) return v.slice(0, MAX_STRING) + '…'
    return v
}

/** Shallow, size-bounded summary of a request body. Omits large config blobs. */
function summarizeBody(body) {
    if (body == null || typeof body !== 'object') return null
    const out = {}
    let n = 0
    for (const k in body) {
        if (n++ >= MAX_KEYS) {
            out._truncated = true
            break
        }
        const v = body[k]
        if (v == null || typeof v !== 'object') out[k] = truncate(v)
        else if (Array.isArray(v)) out[k] = `[array:${v.length}]`
        else if (k === 'config') out[k] = summarizeConfig(v)
        else out[k] = `{keys:${Object.keys(v).length}}`
    }
    return out
}

/** Top-level shape of a mission config: sections present and layer count. */
function summarizeConfig(config) {
    if (typeof config === 'string') {
        try {
            config = JSON.parse(config)
        } catch (e) {
            return '[unparseable config]'
        }
    }
    if (config == null || typeof config !== 'object') return null
    const s = { sections: Object.keys(config) }
    if (Array.isArray(config.layers)) {
        s.layers = config.layers.length
        s.layerNames = config.layers.slice(0, MAX_KEYS).map((l) => l && l.name)
    }
    return s
}

function extractMission(req) {
    const b = req.body || {}
    return b.mission || b.missionName || (req.query && req.query.mission) || null
}

/** Express middleware: records every mutating /api/configure/* call once it responds. */
function auditConfigure(req, res, next) {
    if (!MUTATING_METHODS.has(req.method)) return next()

    const started = Date.now()
    const endpoint = req.originalUrl.split('?')[0]
    const action = endpoint.replace(/^.*\/api\/configure\/?/, '') || '(root)'

    const originalSend = res.send.bind(res)
    let recorded = false
    res.send = function (payload) {
        if (!recorded) {
            recorded = true
            let status = String(res.statusCode)
            let mission = extractMission(req)
            try {
                const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload
                if (parsed && parsed.status) status = String(parsed.status)
                if (!mission && parsed && typeof parsed.mission === 'string') mission = parsed.mission
            } catch (e) {}
            AuditLog.create({
                user: req.user || (req.session && req.session.user) || null,
                mission,
                method: req.method,
                endpoint,
                action,
                status,
                summary: summarizeBody(req.body),
                ip: req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || null,
                duration_ms: Date.now() - started,
            }).catch((err) => {
                logger('error', 'Failed to write audit log entry.', req.originalUrl, req, err)
            })
        }
        return originalSend(payload)
    }
    next()
}

module.exports = { auditConfigure, summarizeBody, summarizeConfig }
