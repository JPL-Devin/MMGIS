/**
 * Shared, dependency-free geometry and matching for the orbital-crossref
 * feature. Imported relatively by all three plugins in this container, which is
 * what the plugins README recommends for code several families need.
 *
 * Nothing here imports from `src/essence`, so it is the part that unit tests.
 */

/** The one fact all three plugins in this container agree on. */
export const OFFSET_PROP = '_crossrefOffsetMeters'
export const MATCH_ID_PROP = '_crossrefTruthId'

const R = 6371000

const toRad = (d) => (d * Math.PI) / 180

/** Great-circle metres between two [lng, lat] positions. */
export function distanceMeters(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return null
    const dLat = toRad(b[1] - a[1])
    const dLng = toRad(b[0] - a[0])
    const s =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

/** A representative [lng, lat] for any geometry (first coordinate). */
export function positionOf(feature) {
    let c = feature?.geometry?.coordinates
    while (Array.isArray(c) && Array.isArray(c[0])) c = c[0]
    return Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1])
        ? [c[0], c[1]]
        : null
}

function get(obj, dotted) {
    if (!dotted) return undefined
    return dotted.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)
}

/**
 * The ground-truth feature a prediction refers to.
 *
 * When `matchProp` is set, matching is by equal property value (the reliable
 * case: the mission's own id). Otherwise it falls back to nearest-by-distance,
 * bounded by `maxDistanceMeters`.
 *
 * @param {Object} prediction A feature of the predictions layer.
 * @param {Array} truths Ground-truth features, from *another* layer.
 * @param {Object} [opts]
 * @returns {{feature: Object, distance: number}|null}
 */
export function matchTruth(prediction, truths, opts = {}) {
    const { matchProp, maxDistanceMeters = Infinity } = opts
    const from = positionOf(prediction)
    if (!from || !Array.isArray(truths)) return null

    const key = matchProp ? get(prediction.properties, matchProp) : undefined
    let best = null
    for (const truth of truths) {
        if (matchProp) {
            if (key == null) return null
            if (String(get(truth.properties, matchProp)) !== String(key)) continue
        }
        const to = positionOf(truth)
        if (!to) continue
        const distance = distanceMeters(from, to)
        if (distance == null) continue
        if (!best || distance < best.distance) best = { feature: truth, distance }
    }
    if (!best) return null
    return best.distance <= maxDistanceMeters ? best : null
}

/**
 * Every prediction paired with its ground truth. Returned pairs carry the
 * offset in metres, which is the number the attachment draws and the
 * interaction reports.
 */
export function pairAll(predictions, truths, opts = {}) {
    const out = []
    for (const prediction of predictions || []) {
        const match = matchTruth(prediction, truths, opts)
        if (!match) continue
        out.push({
            prediction,
            truth: match.feature,
            distance: match.distance,
            from: positionOf(prediction),
            to: positionOf(match.feature),
        })
    }
    return out
}

/** Colour for an offset, on a green→red ramp over `worst` metres. */
export function offsetColor(distance, worst = 1000) {
    const t = Math.max(0, Math.min(1, (distance || 0) / (worst || 1)))
    const r = Math.round(46 + t * (215 - 46))
    const g = Math.round(160 - t * (160 - 25))
    return `rgb(${r},${g},60)`
}
