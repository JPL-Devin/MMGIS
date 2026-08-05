/**
 * Pure viewing-geometry math shared by the LookDirection attachment and the
 * StereoPairs interaction. No MMGIS singletons, no Leaflet — importable in Node
 * so it can be unit tested.
 *
 * There is no documented place for code shared between two plugins in the same
 * container, so this lives with the attachment and the interaction imports it by
 * relative path.
 */

const DEG = Math.PI / 180

export const DEFAULT_FIELDS = {
    emission: 'emission_angle',
    incidence: 'incidence_angle',
    azimuth: 'sub_spacecraft_azimuth',
}

export const DEFAULT_CRITERIA = {
    minConvergence: 5,
    maxConvergence: 35,
    maxEmissionDifference: 25,
    maxIlluminationDifference: 20,
}

const num = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : null)

/** Pull the viewing geometry off a feature, using configurable property names. */
export function geometryOf(feature, fields = {}) {
    const f = { ...DEFAULT_FIELDS }
    // Undefined/blank entries must not shadow the defaults.
    for (const [key, value] of Object.entries(fields))
        if (value) f[key] = value
    const props = feature?.properties || {}
    const emission = num(props[f.emission])
    const azimuth = num(props[f.azimuth])
    if (emission == null || azimuth == null) return null
    return {
        emission,
        azimuth: ((azimuth % 360) + 360) % 360,
        incidence: num(props[f.incidence]),
    }
}

function eachCoordinate(geometry, cb) {
    const walk = (c) => {
        if (!Array.isArray(c)) return
        if (typeof c[0] === 'number' && typeof c[1] === 'number') cb(c)
        else c.forEach(walk)
    }
    walk(geometry?.coordinates)
}

/** [lng, lat] mean of every coordinate — good enough for a footprint centre. */
export function centroidOf(feature) {
    let x = 0
    let y = 0
    let n = 0
    eachCoordinate(feature?.geometry, ([lng, lat]) => {
        x += lng
        y += lat
        n++
    })
    return n ? [x / n, y / n] : null
}

/** [minx, miny, maxx, maxy] */
export function bboxOf(feature) {
    let bbox = null
    eachCoordinate(feature?.geometry, ([lng, lat]) => {
        if (!bbox) bbox = [lng, lat, lng, lat]
        else {
            bbox[0] = Math.min(bbox[0], lng)
            bbox[1] = Math.min(bbox[1], lat)
            bbox[2] = Math.max(bbox[2], lng)
            bbox[3] = Math.max(bbox[3], lat)
        }
    })
    return bbox
}

export function bboxesOverlap(a, b) {
    if (!a || !b) return false
    return !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1])
}

/**
 * Angle between two look directions on the sky, from their emission angles and
 * azimuths — the stereo convergence angle, in degrees.
 *
 *   cos(c) = cos(e1)cos(e2) + sin(e1)sin(e2)cos(az1 - az2)
 */
export function convergenceAngle(a, b) {
    if (!a || !b) return null
    const e1 = a.emission * DEG
    const e2 = b.emission * DEG
    const dAz = (a.azimuth - b.azimuth) * DEG
    const cos =
        Math.cos(e1) * Math.cos(e2) +
        Math.sin(e1) * Math.sin(e2) * Math.cos(dAz)
    return Math.acos(Math.max(-1, Math.min(1, cos))) / DEG
}

/**
 * Does this pair make a usable stereo pair? Returns the metrics plus `usable`
 * so a caller can show why something failed rather than only hiding it.
 */
export function stereoMetrics(a, b, criteria = {}) {
    const c = { ...DEFAULT_CRITERIA }
    for (const [key, value] of Object.entries(criteria))
        if (Number.isFinite(value)) c[key] = value
    const convergence = convergenceAngle(a, b)
    if (convergence == null) return null
    const emissionDifference = Math.abs(a.emission - b.emission)
    const illuminationDifference =
        a.incidence != null && b.incidence != null
            ? Math.abs(a.incidence - b.incidence)
            : null
    const usable =
        convergence >= c.minConvergence &&
        convergence <= c.maxConvergence &&
        emissionDifference <= c.maxEmissionDifference &&
        (illuminationDifference == null ||
            illuminationDifference <= c.maxIlluminationDifference)
    return {
        convergence,
        emissionDifference,
        illuminationDifference,
        usable,
    }
}

/**
 * A record per footprint: what both the attachment (to draw a wedge) and the
 * interaction (to find pairs) need, without either re-walking the geometry.
 */
export function indexFeatures(geojson, fields) {
    return (geojson?.features || [])
        .map((feature, i) => {
            const view = geometryOf(feature, fields)
            const centroid = centroidOf(feature)
            if (!view || !centroid) return null
            return {
                index: i,
                id: feature.id ?? feature.properties?.name ?? i,
                feature,
                centroid,
                bbox: bboxOf(feature),
                view,
            }
        })
        .filter(Boolean)
}

/** Everything in `index` that pairs with `origin`, best convergence first. */
export function pairsFor(origin, index, criteria) {
    if (!origin) return []
    return index
        .filter((r) => r !== origin && bboxesOverlap(origin.bbox, r.bbox))
        .map((r) => ({ record: r, metrics: stereoMetrics(origin.view, r.view, criteria) }))
        .filter((p) => p.metrics?.usable)
        .sort((a, b) => b.metrics.convergence - a.metrics.convergence)
}

/**
 * The spacecraft is in the azimuth direction at the emission angle, so the
 * ground track of the look direction points back along `azimuth`. Longitude is
 * scaled by cos(lat) so the wedge stays visually correct away from the equator.
 */
function offset([lng, lat], bearingDeg, lengthDeg) {
    const b = bearingDeg * DEG
    const dLat = Math.cos(b) * lengthDeg
    const dLng = (Math.sin(b) * lengthDeg) / Math.max(0.05, Math.cos(lat * DEG))
    return [lng + dLng, lat + dLat]
}

/** A LineString from the centre along the look azimuth. */
export function bearingLine(centroid, view, lengthDeg) {
    return {
        type: 'LineString',
        coordinates: [centroid, offset(centroid, view.azimuth, lengthDeg)],
    }
}

/**
 * A wedge (triangle) centred on the look azimuth. Its half-angle grows with the
 * emission angle, so a steeply oblique look reads as a wider wedge.
 */
export function wedge(centroid, view, lengthDeg, halfAngleDeg) {
    const half = halfAngleDeg ?? Math.max(4, view.emission / 3)
    return {
        type: 'Polygon',
        coordinates: [
            [
                centroid,
                offset(centroid, view.azimuth - half, lengthDeg),
                offset(centroid, view.azimuth + half, lengthDeg),
                centroid,
            ],
        ],
    }
}
