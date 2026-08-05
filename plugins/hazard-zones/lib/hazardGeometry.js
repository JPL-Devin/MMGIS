/**
 * Pure geometry helpers shared by every plugin in this container.
 *
 * Dependency-free on purpose: the layer attachment, the interaction and the
 * layer type all import this, and a unit test imports it in plain Node.
 */

const METERS_PER_DEGREE = 111320

/** Rough meters → degrees, latitude-corrected. Good enough for a hazard buffer. */
export function metersToDegrees(meters, latitude = 0) {
    const lat = Number.isFinite(latitude) ? latitude : 0
    const scale = Math.max(Math.cos((lat * Math.PI) / 180), 0.01)
    return meters / (METERS_PER_DEGREE * scale)
}

/** [lng, lat] of a feature's rough centroid, or null. */
export function centroidOf(feature) {
    let coords = flatCoords(feature?.geometry)
    if (!coords.length) return null
    // A closed ring repeats its first vertex, which would weight that corner.
    const first = coords[0]
    const last = coords[coords.length - 1]
    if (coords.length > 2 && first[0] === last[0] && first[1] === last[1])
        coords = coords.slice(0, -1)
    let x = 0
    let y = 0
    coords.forEach((c) => {
        x += c[0]
        y += c[1]
    })
    return [x / coords.length, y / coords.length]
}

/** Every [lng, lat] in any geometry, flattened. */
export function flatCoords(geometry) {
    if (!geometry) return []
    const out = []
    const walk = (c) => {
        if (!Array.isArray(c)) return
        if (typeof c[0] === 'number' && typeof c[1] === 'number') out.push(c)
        else c.forEach(walk)
    }
    walk(geometry.coordinates)
    return out
}

/** Ray casting against one ring of [lng, lat] pairs. */
export function pointInRing(point, ring) {
    if (!point || !Array.isArray(ring) || ring.length < 3) return false
    const [x, y] = point
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]
        const [xj, yj] = ring[j]
        const intersects =
            (yi > y) !== (yj > y) &&
            x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
        if (intersects) inside = !inside
    }
    return inside
}

/** Point-in-polygon over Polygon and MultiPolygon, holes respected. */
export function pointInPolygonFeature(point, feature) {
    const geometry = feature?.geometry
    if (!geometry) return false
    const polygons =
        geometry.type === 'MultiPolygon'
            ? geometry.coordinates
            : geometry.type === 'Polygon'
              ? [geometry.coordinates]
              : []
    return polygons.some((rings) => {
        if (!pointInRing(point, rings[0])) return false
        return !rings.slice(1).some((hole) => pointInRing(point, hole))
    })
}

/**
 * Grow every ring of a polygon feature outward from its centroid by `meters`.
 *
 * A vertex-scaling approximation, not a true Minkowski buffer — it is convex-
 * correct and cheap, which is what a visual exclusion band and an "is this
 * inside the buffer" test need. Returns null for non-polygon geometry.
 */
export function bufferPolygonFeature(feature, meters) {
    const geometry = feature?.geometry
    if (!geometry || !(meters > 0)) return null
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')
        return null

    const center = centroidOf(feature)
    if (!center) return null
    const grow = (ring) =>
        ring.map(([lng, lat]) => {
            const dx = lng - center[0]
            const dy = lat - center[1]
            const dist = Math.sqrt(dx * dx + dy * dy) || 1e-9
            const pad = metersToDegrees(meters, lat)
            return [lng + (dx / dist) * pad, lat + (dy / dist) * pad]
        })

    const coordinates =
        geometry.type === 'Polygon'
            ? geometry.coordinates.map(grow)
            : geometry.coordinates.map((rings) => rings.map(grow))

    return {
        type: 'Feature',
        properties: { ...(feature.properties || {}), _hazardBuffer: meters },
        geometry: { type: geometry.type, coordinates },
    }
}

/**
 * Which zones a point falls in.
 *
 * @param {Array} point [lng, lat]
 * @param {Array} zones [{ layerName, feature, buffered }] — `buffered` is the
 *   grown feature the HazardBuffer attachment built, when there is one.
 * @returns {Array} [{ layerName, name, severity, within: 'zone'|'buffer' }]
 */
export function zonesContaining(point, zones) {
    if (!point) return []
    const hits = []
    ;(zones || []).forEach((z) => {
        const inZone = pointInPolygonFeature(point, z.feature)
        const inBuffer =
            !inZone && z.buffered
                ? pointInPolygonFeature(point, z.buffered)
                : false
        if (!inZone && !inBuffer) return
        const props = z.feature?.properties || {}
        hits.push({
            layerName: z.layerName,
            name: props.name ?? props.Name ?? props.id ?? 'Unnamed zone',
            severity: props.severity ?? props.Severity ?? null,
            within: inZone ? 'zone' : 'buffer',
        })
    })
    return hits
}

/** The severity → color scale the layer type's legend and the buffer share. */
export const SEVERITY_COLORS = {
    low: '#ffd54f',
    medium: '#fb8c00',
    high: '#e53935',
    extreme: '#8e24aa',
}

export function colorForSeverity(severity, fallback = '#e53935') {
    if (severity == null) return fallback
    return SEVERITY_COLORS[String(severity).toLowerCase()] || fallback
}

export default {
    metersToDegrees,
    centroidOf,
    flatCoords,
    pointInRing,
    pointInPolygonFeature,
    bufferPolygonFeature,
    zonesContaining,
    colorForSeverity,
    SEVERITY_COLORS,
}
