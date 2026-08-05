/**
 * Pure trail/fade helpers for the TelemetryTrail attachment — dependency-free
 * (no Leaflet, no MMGIS singletons) so they can be unit-tested in Node.
 */

export function parseTime(v) {
    if (v == null || v === '') return null
    if (typeof v === 'number') return Number.isFinite(v) ? v : null
    const t = Date.parse(v)
    return Number.isNaN(t) ? null : t
}

export const defaultGetIn = (obj, path) => {
    if (obj == null || path == null) return undefined
    return String(path)
        .split('.')
        .reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

export function num(v, fallback) {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : fallback
}

export function featureTime(feature, startProp, endProp, getIn = defaultGetIn) {
    const props = feature && feature.properties
    if (!props) return null
    let raw
    if (endProp) raw = getIn(props, endProp)
    if (raw == null && startProp) raw = getIn(props, startProp)
    return parseTime(raw)
}

/**
 * Point features of a collection, paired with their [lat,lng] and epoch-ms time,
 * sorted ascending by time (untimed points sort last, keeping input order).
 */
export function timedPoints(geojson, startProp, endProp, getIn = defaultGetIn) {
    const out = (geojson?.features || [])
        .filter((f) => f?.geometry?.type === 'Point')
        .map((f, i) => {
            const [lng, lat] = f.geometry.coordinates
            return { feature: f, latlng: [lat, lng], ms: featureTime(f, startProp, endProp, getIn), i }
        })
    return out.sort((a, b) => {
        if (a.ms == null && b.ms == null) return a.i - b.i
        if (a.ms == null) return 1
        if (b.ms == null) return -1
        return a.ms - b.ms
    })
}

/**
 * Opacity for a feature given the playhead, its own time, and a fade window.
 *   - a feature at or after the playhead reads full opacity (age <= 0)
 *   - older features fade linearly to `minOpacity` across `fadeMs`
 *   - beyond `fadeMs`, `minOpacity`
 * Untimed features (`featureMs == null`) keep full opacity.
 */
export function fadeOpacity(featureMs, playheadMs, fadeMs, minOpacity = 0.1) {
    if (featureMs == null || playheadMs == null) return 1
    const age = playheadMs - featureMs
    if (age <= 0) return 1
    if (!(fadeMs > 0)) return minOpacity
    if (age >= fadeMs) return minOpacity
    return 1 - (age / fadeMs) * (1 - minOpacity)
}
