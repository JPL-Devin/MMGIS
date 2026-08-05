/**
 * ContactTicks — pure geometry, free of Leaflet and `src/essence`.
 *
 * Turns a host layer's line features into renderable descriptors: the contact
 * line itself (dashed by a certainty property) and a short strike/dip tick at
 * its midpoint. contactTicks.js is the thin adapter that turns these into
 * Leaflet polylines. Kept dependency-free so it is unit-testable in Node.
 *
 * Coordinates are [lng, lat] on the way in (GeoJSON) and [lat, lng] on the way
 * out (Leaflet). Tick length is in degrees — an approximation, since a pixel- or
 * metre-accurate tick would need the live map's projection, which this pure
 * module deliberately does not have.
 */

export const DEFAULTS = {
    strikeProp: 'strike',
    dipProp: 'dip',
    certaintyProp: 'certainty',
    tickSizeDeg: 0.02,
}

// Certainty values that make a contact a dashed line, with their dash pattern.
const DASH_BY_CERTAINTY = {
    approximate: '6 4',
    inferred: '2 6',
    concealed: '1 8',
}

/**
 * @param {string|number|undefined} value
 * @returns {string|null} a Leaflet dashArray, or null for a solid line.
 */
export function dashForCertainty(value) {
    if (value == null) return null
    return DASH_BY_CERTAINTY[String(value).toLowerCase().trim()] || null
}

function toLatLngs(coords) {
    return coords.map(([lng, lat]) => [lat, lng])
}

/** Bearing of the segment around a line's midpoint, in degrees (0 = north). */
function midBearingDeg(coords) {
    const mid = Math.floor((coords.length - 1) / 2)
    const [lng1, lat1] = coords[mid]
    const [lng2, lat2] = coords[mid + 1] || coords[mid - 1] || coords[mid]
    return (Math.atan2(lng2 - lng1, lat2 - lat1) * 180) / Math.PI
}

/** Midpoint vertex of a line as [lat, lng]. */
function midLatLng(coords) {
    const mid = Math.floor(coords.length / 2)
    const [lng, lat] = coords[mid]
    return [lat, lng]
}

/**
 * A short tick centred on the midpoint, perpendicular to `strikeDeg` (or to the
 * line itself when no strike property is given). Returns the two [lat, lng]
 * endpoints.
 */
export function tickEndpoints(coords, strikeDeg, lengthDeg) {
    const [lat, lng] = midLatLng(coords)
    const strike = Number.isFinite(strikeDeg) ? strikeDeg : midBearingDeg(coords)
    // Dip direction is perpendicular to strike.
    const dipRad = ((strike + 90) * Math.PI) / 180
    const half = lengthDeg / 2
    const dLat = Math.cos(dipRad) * half
    const dLng = Math.sin(dipRad) * half
    return [
        [lat - dLat, lng - dLng],
        [lat + dLat, lng + dLng],
    ]
}

const lineCoords = (geom) => {
    if (!geom) return []
    if (geom.type === 'LineString') return [geom.coordinates]
    if (geom.type === 'MultiLineString') return geom.coordinates
    return []
}

const num = (v) => {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : undefined
}

/**
 * Build renderable descriptors for every line feature in a FeatureCollection.
 * Non-line features (unit polygons, points) are skipped — a geologicunits layer
 * can hold both, and only its contacts get ticks.
 *
 * @param {object} geojson  a FeatureCollection (or anything with `.features`)
 * @param {object} [config] the attachment's resolved settings (property names)
 * @returns {Array<{type:'line'|'tick', latlngs:number[][], dashArray:?string,
 *   tooltip:?string}>}
 */
export function contactRenderables(geojson, config = {}) {
    const { strikeProp, dipProp, certaintyProp, tickSizeDeg } = {
        ...DEFAULTS,
        ...config,
    }
    const out = []
    for (const f of geojson?.features || []) {
        const parts = lineCoords(f.geometry)
        if (!parts.length) continue
        const props = f.properties || {}
        const dashArray = dashForCertainty(props[certaintyProp])
        const strike = num(props[strikeProp])
        const dip = num(props[dipProp])
        for (const coords of parts) {
            if (coords.length < 2) continue
            out.push({
                type: 'line',
                latlngs: toLatLngs(coords),
                dashArray,
                tooltip: null,
            })
            out.push({
                type: 'tick',
                latlngs: tickEndpoints(coords, strike, tickSizeDeg),
                dashArray: null,
                tooltip:
                    strike != null || dip != null
                        ? `strike ${strike ?? '?'}° / dip ${dip ?? '?'}°`
                        : null,
            })
        }
    }
    return out
}
