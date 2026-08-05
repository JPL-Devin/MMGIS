/**
 * Radargram geometry, with nothing imported from `src/essence`.
 *
 * This is the fact table for the whole feature: how deep a radargram hangs, and
 * how a depth relates to a position in the image. The attachment and the
 * interaction need the same numbers, so they are defined once here and
 * *declared* to the siblings through the manifest
 * (`capabilities.defaultAttachments` / `defaultInteractions`) rather than
 * imported across plugin boundaries.
 */

/** Speed of light in vacuum, m/ns — radar depths are computed from it. */
export const C_M_PER_NS = 0.299792458

export const DEFAULTS = {
    imageProp: 'radargram_url',
    maxDepthMeters: 3000,
    verticalExaggeration: 1,
    dielectric: 3.15, // water ice, the usual assumption for a polar sounder
}

export function num(v, fallback) {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : fallback
}

/** The layer's radargram settings, defaulted. */
export function settingsOf(layerObj) {
    const v = layerObj?.variables?.radargram || {}
    return {
        imageProp: v.imageProp || DEFAULTS.imageProp,
        maxDepthMeters: num(v.maxDepthMeters, DEFAULTS.maxDepthMeters),
        verticalExaggeration: num(
            v.verticalExaggeration,
            DEFAULTS.verticalExaggeration
        ),
    }
}

/**
 * Depth below the surface for a two-way travel time.
 * @param {number} twtNs   two-way travel time, nanoseconds
 * @param {number} dielectric  real part of the dielectric permittivity
 * @returns {number} meters
 */
export function depthFromTwoWayTime(twtNs, dielectric = DEFAULTS.dielectric) {
    const eps = num(dielectric, DEFAULTS.dielectric)
    if (!(eps > 0)) return NaN
    return (num(twtNs, NaN) * C_M_PER_NS) / (2 * Math.sqrt(eps))
}

/**
 * Where a depth sits in the radargram image, 0 at the surface, 1 at the bottom
 * row. This is the one number the attachment and the interaction must agree
 * with the curtain on, and it is why `maxDepthMeters` is declared to both.
 */
export function depthToImageFraction(depthMeters, maxDepthMeters) {
    const max = num(maxDepthMeters, DEFAULTS.maxDepthMeters)
    if (!(max > 0)) return NaN
    return num(depthMeters, NaN) / max
}

/** Squared planar distance, good enough for "which vertex is nearest". */
function d2(a, b) {
    const dx = a[0] - b[0]
    const dy = a[1] - b[1]
    return dx * dx + dy * dy
}

/**
 * The vertex of a track nearest a clicked lng/lat, and how far along the track
 * it is (0..1 by vertex count, which is what a radargram's horizontal axis is:
 * one column per trace, not per meter).
 * @param {number[][]} coordinates  LineString coordinates
 * @param {{lng:number, lat:number}} lnglat
 */
export function nearestTrace(coordinates, lnglat) {
    if (!Array.isArray(coordinates) || coordinates.length === 0) return null
    if (lnglat == null || !Number.isFinite(lnglat.lng)) return null
    const target = [lnglat.lng, lnglat.lat]
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < coordinates.length; i++) {
        const dist = d2(coordinates[i], target)
        if (dist < bestD) {
            bestD = dist
            best = i
        }
    }
    return {
        index: best,
        alongTrack:
            coordinates.length > 1 ? best / (coordinates.length - 1) : 0,
        coordinate: coordinates[best],
    }
}

/**
 * What the depth probe reports for a click. Pure so it can be unit tested:
 * the interaction handler is the adapter that finds these arguments.
 */
export function probe(feature, lnglat, config) {
    const geometry = feature?.geometry
    if (geometry == null) return null
    const coordinates =
        geometry.type === 'LineString'
            ? geometry.coordinates
            : geometry.type === 'MultiLineString'
              ? geometry.coordinates[0]
              : null
    if (coordinates == null) return null

    const trace = nearestTrace(coordinates, lnglat)
    if (trace == null) return null

    const {
        twoWayTimeProp = 'twt_ns',
        maxDepthMeters = DEFAULTS.maxDepthMeters,
        dielectric = DEFAULTS.dielectric,
    } = config || {}

    // A per-trace two-way time array is the honest source; a scalar property
    // covers the common "one number for the whole track" case.
    const twt = feature.properties?.[twoWayTimeProp]
    const twtNs = Array.isArray(twt) ? twt[trace.index] : twt

    const depth =
        twtNs == null
            ? // No travel time: fall back to the curtain's own depth axis, which
              // is what the user is looking at anyway.
              depthToImageFraction(1, 1) * num(maxDepthMeters, NaN)
            : depthFromTwoWayTime(twtNs, dielectric)

    return {
        traceIndex: trace.index,
        alongTrack: trace.alongTrack,
        lng: trace.coordinate[0],
        lat: trace.coordinate[1],
        twtNs: twtNs == null ? null : num(twtNs, null),
        depthMeters: depth,
        imageFraction: depthToImageFraction(depth, maxDepthMeters),
        estimated: twtNs == null,
    }
}
