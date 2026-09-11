/**
 * HighlightNeighbors's pure decisions: nothing imported from `src/essence`.
 */

export const DEFAULTS = {
    radius: 500,
    includeOtherLayers: false,
    maxResults: 25,
    color: '#ffdd00',
}

export function resolveConfig(config) {
    const c = config || {}
    return {
        radius: Number(c.radius) > 0 ? Number(c.radius) : DEFAULTS.radius,
        includeOtherLayers:
            c.includeOtherLayers === true || c.includeOtherLayers === 'true',
        maxResults:
            Number(c.maxResults) > 0 ? Number(c.maxResults) : DEFAULTS.maxResults,
        color: c.color || DEFAULTS.color,
    }
}

/** Returns [lng, lat] centroid of any GeoJSON geometry, or null. */
export function geometryCenter(geometry) {
    if (!geometry) return null
    const pts = []
    const walk = (c) => {
        if (typeof c[0] === 'number') pts.push(c)
        else c.forEach(walk)
    }
    if (geometry.type === 'GeometryCollection')
        geometry.geometries.forEach((g) => walk(g.coordinates))
    else if (geometry.coordinates) walk(geometry.coordinates)
    if (pts.length === 0) return null
    const sum = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0])
    return [sum[0] / pts.length, sum[1] / pts.length]
}

export function bearingToCompass(bearing) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    return dirs[Math.round((((bearing % 360) + 360) % 360) / 45) % 8]
}

export function formatDistance(m) {
    return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(1)} m`
}

/**
 * Filters and sorts candidates by distance from the origin.
 * @param {[number, number]} origin [lng, lat]
 * @param {Array<{center:[number,number]}>} candidates
 * @param {{radius:number, maxResults:number}} cfg
 * @param {(lng1,lat1,lng2,lat2)=>number} distFn meters
 * @param {(lat1,lng1,lat2,lng2)=>number} bearingFn degrees
 */
export function findNeighbors(origin, candidates, cfg, distFn, bearingFn) {
    if (!origin) return []
    return candidates
        .filter((c) => c.center)
        .map((c) => ({
            ...c,
            distance: distFn(origin[0], origin[1], c.center[0], c.center[1]),
            bearing: bearingFn(origin[1], origin[0], c.center[1], c.center[0]),
        }))
        .filter((c) => c.distance > 0 && c.distance <= cfg.radius)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, cfg.maxResults)
}
