const express = require('express')
const router = express.Router()

// A stand-in for an instrument team's planning catalogue: POST-only, paged, and
// bbox-filtered. Swaths are generated deterministically from a grid so the same
// viewport always answers with the same plan.
const PAGE_SIZE = 50
const GRID = 2.5

const swathAt = (lat, lng) => {
    const seed = Math.abs(Math.round(lat * 7 + lng * 13))
    const azimuth = (seed * 37) % 360
    const roll = ((seed * 11) % 61) - 30
    const halfWidthDeg = 0.35 + ((seed % 5) * 0.05)
    const a = (azimuth * Math.PI) / 180
    const dx = Math.sin(a) * 1.1
    const dy = Math.cos(a) * 1.1
    const px = Math.cos(a) * halfWidthDeg
    const py = -Math.sin(a) * halfWidthDeg
    const ring = [
        [lng - dx + px, lat - dy + py],
        [lng + dx + px, lat + dy + py],
        [lng + dx - px, lat + dy - py],
        [lng - dx - px, lat - dy - py],
    ]
    ring.push(ring[0])
    return {
        type: 'Feature',
        properties: {
            swath_id: `SW-${seed}`,
            look_azimuth: azimuth,
            roll_deg: roll,
            look_direction: roll >= 0 ? 'right' : 'left',
            start_utc: new Date(Date.UTC(2026, 0, 1 + (seed % 300))).toISOString(),
            duration_s: 90 + (seed % 120),
        },
        geometry: { type: 'Polygon', coordinates: [ring] },
    }
}

const inWindow = (feature, time) => {
    if (!time || !time.start || !time.end) return true
    const t = Date.parse(feature.properties.start_utc)
    return t >= Date.parse(time.start) && t <= Date.parse(time.end)
}

router.post('/search', (req, res) => {
    const { bbox, page = 0, pageSize = PAGE_SIZE, time = null } = req.body || {}
    if (!Array.isArray(bbox) || bbox.length !== 4)
        return res.status(400).send({ status: 'failure', message: 'bbox required' })

    const [minx, miny, maxx, maxy] = bbox.map(Number)
    const all = []
    const startLat = Math.ceil(Math.max(miny, -85) / GRID) * GRID
    const startLng = Math.ceil(minx / GRID) * GRID
    for (let lat = startLat; lat <= Math.min(maxy, 85); lat += GRID)
        for (let lng = startLng; lng <= maxx; lng += GRID) {
            const f = swathAt(lat, lng)
            if (inWindow(f, time)) all.push(f)
        }

    const size = Math.max(1, Math.min(Number(pageSize) || PAGE_SIZE, 500))
    const p = Math.max(0, Number(page) || 0)
    res.send({
        page: p,
        pageSize: size,
        pages: Math.max(1, Math.ceil(all.length / size)),
        total: all.length,
        features: all.slice(p * size, p * size + size),
    })
})

module.exports = router
