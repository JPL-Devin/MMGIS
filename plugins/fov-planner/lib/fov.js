/**
 * Shared instrument field-of-view geometry for the fov-planner container.
 *
 * Pure functions only — no `src/essence` imports, no Leaflet, no window — so
 * every plugin in the container can import it relatively and a Node unit test
 * can cover it.
 *
 * The body radius matters: MMGIS missions are not all Earth, so every metre →
 * degree conversion here takes the radius rather than assuming 6378137.
 */

export const EARTH_RADIUS_M = 6378137

const DEG = Math.PI / 180

/** Read a possibly-nested property off a feature without importing F_. */
export function propOf(feature, path, fallback = undefined) {
    if (!feature || !path) return fallback
    let node = feature.properties
    for (const key of String(path).split('.')) {
        if (node == null || typeof node !== 'object') return fallback
        node = node[key]
    }
    return node == null ? fallback : node
}

export function toNumber(value, fallback) {
    const n = parseFloat(value)
    return Number.isFinite(n) ? n : fallback
}

/**
 * Offset a lon/lat by a distance and bearing on a sphere of `radius` metres.
 * @returns {[number, number]} [lng, lat]
 */
export function destination(lng, lat, bearingDeg, distanceM, radius = EARTH_RADIUS_M) {
    const d = distanceM / radius
    const b = bearingDeg * DEG
    const lat1 = lat * DEG
    const lng1 = lng * DEG
    const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b)
    )
    const lng2 =
        lng1 +
        Math.atan2(
            Math.sin(b) * Math.sin(d) * Math.cos(lat1),
            Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
        )
    return [((lng2 / DEG + 540) % 360) - 180, lat2 / DEG]
}

/**
 * The ground footprint of one pointed observation, as a closed ring of
 * [lng, lat] pairs: the sensor position, then an arc of `fovDeg` centred on
 * `azimuthDeg` at `rangeM`.
 *
 * A `fovDeg` of 360 (or more) is a full circle — a nadir/panoramic instrument —
 * and drops the apex vertex so the ring is a disc rather than a pac-man.
 */
export function fovRing(lng, lat, azimuthDeg, fovDeg, rangeM, options = {}) {
    const radius = toNumber(options.bodyRadius, EARTH_RADIUS_M)
    const steps = Math.max(4, Math.round(toNumber(options.steps, 24)))
    const fov = Math.max(0, toNumber(fovDeg, 30))
    const range = Math.max(0, toNumber(rangeM, 0))
    const azimuth = toNumber(azimuthDeg, 0)

    if (range === 0 || fov === 0) return []

    const full = fov >= 360
    const half = full ? 180 : fov / 2
    const ring = full ? [] : [[lng, lat]]

    for (let i = 0; i <= steps; i++) {
        const bearing = azimuth - half + (fov * i) / steps
        ring.push(destination(lng, lat, bearing, range, radius))
    }
    if (!full) ring.push([lng, lat])
    else ring.push(ring[0])

    return ring
}

/** Turn a host feature into its footprint polygon feature, or null. */
export function footprintFor(feature, config = {}) {
    const coords = feature?.geometry?.coordinates
    if (feature?.geometry?.type !== 'Point' || !Array.isArray(coords)) return null

    const azimuth = toNumber(propOf(feature, config.azimuthProp || 'azimuth'), null)
    if (azimuth === null) return null

    const fov = toNumber(
        propOf(feature, config.fovProp || 'fov'),
        toNumber(config.defaultFovDeg, 30)
    )
    const range = toNumber(
        propOf(feature, config.rangeProp || 'range'),
        toNumber(config.defaultRangeMeters, 500)
    )

    const ring = fovRing(coords[0], coords[1], azimuth, fov, range, {
        bodyRadius: config.bodyRadius,
        steps: config.steps,
    })
    if (ring.length === 0) return null

    return {
        type: 'Feature',
        properties: { ...(feature.properties || {}), _fovAzimuth: azimuth, _fovDeg: fov, _fovRangeM: range },
        geometry: { type: 'Polygon', coordinates: [ring] },
    }
}

export function footprintCollection(geojson, config = {}) {
    const features = (geojson?.features || [])
        .map((f) => footprintFor(f, config))
        .filter(Boolean)
    return { type: 'FeatureCollection', features }
}

/** Axis-aligned bounds of a ring: [minx, miny, maxx, maxy]. */
export function boundsOf(ring) {
    return ring.reduce(
        (b, [x, y]) => [
            Math.min(b[0], x),
            Math.min(b[1], y),
            Math.max(b[2], x),
            Math.max(b[3], y),
        ],
        [Infinity, Infinity, -Infinity, -Infinity]
    )
}

export function boundsIntersect(a, b) {
    return !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1])
}

/**
 * Which of `others` have footprints overlapping `target`'s.
 *
 * Deliberately a bounds test, not a true polygon intersection: this is a
 * planning hint ("these three observations may be redundant"), and pulling a
 * geometry library into a plugin for an answer nobody measures is not worth it.
 * `overlapKind: 'bounds'` on the result says so to whatever renders it.
 */
export function overlapping(target, others, config = {}) {
    const t = footprintFor(target, config)
    if (!t) return []
    const tb = boundsOf(t.geometry.coordinates[0])
    const idProp = config.idProp || 'name'

    return (others || [])
        .filter((f) => f !== target)
        .map((f) => ({ feature: f, footprint: footprintFor(f, config) }))
        .filter(({ footprint }) => footprint)
        .filter(({ footprint }) => boundsIntersect(tb, boundsOf(footprint.geometry.coordinates[0])))
        .map(({ feature }) => ({
            id: propOf(feature, idProp, '(unnamed)'),
            overlapKind: 'bounds',
        }))
}

/** A one-observation summary for the coverage bar. */
export function summarize(target, others, config = {}) {
    const conflicts = overlapping(target, others, config)
    return {
        id: propOf(target, config.idProp || 'name', '(unnamed)'),
        azimuth: toNumber(propOf(target, config.azimuthProp || 'azimuth'), null),
        fov: toNumber(propOf(target, config.fovProp || 'fov'), toNumber(config.defaultFovDeg, 30)),
        range: toNumber(
            propOf(target, config.rangeProp || 'range'),
            toNumber(config.defaultRangeMeters, 500)
        ),
        conflicts,
        conflictCount: conflicts.length,
    }
}
