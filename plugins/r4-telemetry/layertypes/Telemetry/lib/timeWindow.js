/**
 * Pure time-window helpers for the Telemetry layer type.
 *
 * Deliberately dependency-free (no MMGIS singletons, no Leaflet) so it can be
 * imported and unit-tested in Node — the browser-only bits live in source.js.
 */

/** Parse an ISO string (or epoch ms number) to epoch ms, or null. */
export function parseTime(v) {
    if (v == null || v === '') return null
    if (typeof v === 'number') return Number.isFinite(v) ? v : null
    const t = Date.parse(v)
    return Number.isNaN(t) ? null : t
}

/** Default dotted-path getter, used when no `getIn` is supplied. */
export function defaultGetIn(obj, path) {
    if (obj == null || path == null) return undefined
    return String(path)
        .split('.')
        .reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

/**
 * The epoch-ms timestamp a feature represents. Prefers `endProp`, falling back
 * to `startProp` — a point-in-time feature usually only has one. Returns null
 * when the feature carries no readable timestamp.
 */
export function featureTime(feature, startProp, endProp, getIn = defaultGetIn) {
    const props = feature && feature.properties
    if (!props) return null
    let raw
    if (endProp) raw = getIn(props, endProp)
    if (raw == null && startProp) raw = getIn(props, startProp)
    return parseTime(raw)
}

/**
 * Keep only the features whose timestamp falls within [start, end]. Features
 * with no readable timestamp are kept (they are not "of a time"), and an
 * unparseable window returns the collection unchanged.
 *
 * @returns {{type:'FeatureCollection', features: Array}}
 */
export function filterFeaturesByWindow(
    featureCollection,
    start,
    end,
    startProp,
    endProp,
    getIn = defaultGetIn
) {
    const features = (featureCollection && featureCollection.features) || []
    const s = parseTime(start)
    const e = parseTime(end)
    if (s == null || e == null)
        return { type: 'FeatureCollection', features }

    const kept = features.filter((f) => {
        const t = featureTime(f, startProp, endProp, getIn)
        return t == null || (t >= s && t <= e)
    })
    return { type: 'FeatureCollection', features: kept }
}
