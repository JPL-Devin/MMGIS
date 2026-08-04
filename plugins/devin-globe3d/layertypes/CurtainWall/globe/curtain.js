/**
 * Curtain layer type — engine-neutral geometry, kept pure so it can be unit
 * tested without a globe.
 *
 * A curtain is a vertical image hung along a ground track: the radargram of a
 * subsurface sounder (SHARAD, RIMFAX, MARSIS), a seismic section, an aircraft
 * flight-level profile. The image's x axis is distance along the track and its y
 * axis is depth/altitude, so the render is a ribbon standing on (or hanging
 * below) the line.
 */

/** The track's coordinates, from a FeatureCollection, Feature or geometry. */
export function trackCoordinates(geojson) {
    const geometry = firstGeometry(geojson)
    if (!geometry) return []
    if (geometry.type === 'LineString') return dedupe(geometry.coordinates)
    if (geometry.type === 'MultiLineString')
        return dedupe(geometry.coordinates.flat())
    return []
}

function firstGeometry(geojson) {
    if (!geojson) return null
    if (geojson.type === 'FeatureCollection')
        return geojson.features?.find(
            (f) =>
                f?.geometry?.type === 'LineString' ||
                f?.geometry?.type === 'MultiLineString'
        )?.geometry
    if (geojson.type === 'Feature') return geojson.geometry
    if (geojson.coordinates) return geojson
    return null
}

function dedupe(coords) {
    return coords.filter(
        (c, i) =>
            Array.isArray(c) &&
            Number.isFinite(c[0]) &&
            Number.isFinite(c[1]) &&
            (i === 0 || c[0] !== coords[i - 1][0] || c[1] !== coords[i - 1][1])
    )
}

/**
 * The two height rails of the curtain, one pair per track vertex.
 *
 * `top`/`bottom` are meters relative to the datum. When the track carries
 * per-vertex heights (a `heights` property, or 3D coordinates) the curtain
 * follows them: the surface return of a sounder is not at a constant elevation.
 */
export function heightRails(coords, config) {
    const { top, bottom, perVertex } = config
    const maximumHeights = []
    const minimumHeights = []
    coords.forEach((c, i) => {
        const base = Number.isFinite(perVertex?.[i])
            ? perVertex[i]
            : Number.isFinite(c[2])
              ? c[2]
              : 0
        maximumHeights.push(base + top)
        minimumHeights.push(base + bottom)
    })
    return { maximumHeights, minimumHeights }
}

/** Great-circle-ish length of the track in meters, for the legend's x axis. */
export function trackLength(coords, radius = 3396190) {
    let total = 0
    for (let i = 1; i < coords.length; i++) {
        const [lng1, lat1] = coords[i - 1]
        const [lng2, lat2] = coords[i]
        const p1 = (lat1 * Math.PI) / 180
        const p2 = (lat2 * Math.PI) / 180
        const dp = p2 - p1
        const dl = ((lng2 - lng1) * Math.PI) / 180
        const a =
            Math.sin(dp / 2) ** 2 +
            Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
        total += 2 * radius * Math.asin(Math.min(1, Math.sqrt(a)))
    }
    return total
}

/** Read the curtain's settings off the layer's config object. */
export function curtainConfig(layerObj) {
    const c = layerObj.variables?.curtain || {}
    return {
        image: c.image || layerObj.image || null,
        top: num(c.top, 0),
        bottom: num(c.bottom, -1000),
        repeat: c.repeat === true,
        transparent: c.transparent !== false,
        outlineColor: c.outlineColor || null,
        perVertex: Array.isArray(c.heights) ? c.heights : null,
        depthLabel: c.depthLabel || 'Depth (m)',
    }
}

function num(value, fallback) {
    const n = parseFloat(value)
    return Number.isFinite(n) ? n : fallback
}
