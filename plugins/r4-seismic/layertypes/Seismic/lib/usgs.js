/**
 * Pure helpers for the seismic source. No MMGIS singletons, no Leaflet — so
 * they are importable (and unit testable) in Node.
 */

const num = (v, fallback) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback)

export const DEFAULT_ENDPOINT = 'https://earthquake.usgs.gov/fdsnws/event/1/query'

/**
 * Build an FDSN event query for the current view.
 *
 * @param {Object} opts
 * @param {string} opts.endpoint FDSN event service url.
 * @param {Object|null} opts.view `ctx.view` — minx/miny/maxx/maxy of the map.
 * @param {Object|null} opts.time `ctx.time` — { start, end } when time-enabled.
 * @param {number} opts.minMagnitude
 * @param {number} opts.limit
 * @returns {string} A fully formed url.
 */
export function buildQueryUrl({
    endpoint = DEFAULT_ENDPOINT,
    view = null,
    time = null,
    minMagnitude = 2.5,
    limit = 500,
} = {}) {
    const url = new URL(endpoint)
    url.searchParams.set('format', 'geojson')
    url.searchParams.set('orderby', 'time')
    url.searchParams.set('limit', String(Math.max(1, Math.min(20000, limit))))
    url.searchParams.set('minmagnitude', String(minMagnitude))
    if (view) {
        // FDSN clamps rather than wraps, so a world-spanning view is simply omitted.
        const minlon = Math.max(-180, num(view.minx, -180))
        const maxlon = Math.min(180, num(view.maxx, 180))
        const minlat = Math.max(-90, num(view.miny, -90))
        const maxlat = Math.min(90, num(view.maxy, 90))
        url.searchParams.set('minlongitude', String(minlon))
        url.searchParams.set('maxlongitude', String(maxlon))
        url.searchParams.set('minlatitude', String(minlat))
        url.searchParams.set('maxlatitude', String(maxlat))
    }
    if (time?.start) url.searchParams.set('starttime', time.start)
    if (time?.end) url.searchParams.set('endtime', time.end)
    return url.toString()
}

/**
 * USGS gives magnitude as `mag` and depth only as the third coordinate. Both are
 * promoted to plain feature properties so a mission can style with
 * `"color": "prop-magnitude"` and the attachment/interaction can read them
 * without knowing they came from FDSN.
 *
 * @param {Object} geojson An FDSN GeoJSON FeatureCollection.
 * @returns {Object} A FeatureCollection whose features carry `magnitude`,
 *   `depth_km`, `time_iso` and `title`.
 */
export function normalizeEvents(geojson) {
    const features = (geojson?.features || [])
        .filter((f) => f?.geometry?.type === 'Point')
        .map((f) => {
            const p = f.properties || {}
            const coords = f.geometry.coordinates || []
            const magnitude = num(p.mag, null)
            const depth = num(coords[2], null)
            const t = num(p.time, null)
            return {
                ...f,
                properties: {
                    ...p,
                    magnitude,
                    depth_km: depth,
                    time_iso: t == null ? null : new Date(t).toISOString(),
                    title: p.title || p.place || 'Seismic event',
                },
            }
        })
    return { type: 'FeatureCollection', features }
}

/**
 * Events within `windowMinutes` of `feature`, nearest in time first, excluding
 * the feature itself. Time is read from `properties.time` (epoch ms, what FDSN
 * gives) falling back to `properties.time_iso`.
 */
export function temporalNeighbors(features, feature, windowMinutes = 60) {
    const t0 = eventTime(feature)
    if (t0 == null) return []
    const windowMs = windowMinutes * 60000
    return (features || [])
        .filter((f) => f !== feature && f?.properties?.id !== feature?.properties?.id)
        .map((f) => ({ feature: f, dt: Math.abs((eventTime(f) ?? Infinity) - t0) }))
        .filter((n) => n.dt <= windowMs)
        .sort((a, b) => a.dt - b.dt)
}

export function eventTime(feature) {
    const p = feature?.properties || {}
    const t = num(p.time, null)
    if (t != null) return t
    const parsed = p.time_iso ? Date.parse(p.time_iso) : NaN
    return Number.isNaN(parsed) ? null : parsed
}

/** Ring radius in metres for a magnitude — area grows with released energy. */
export function ringRadiusMeters(magnitude, scale = 2000) {
    const m = num(magnitude, 0)
    if (m <= 0) return scale
    return scale * Math.pow(2, m)
}

/** Depth-banded colour, shallow (hot) → deep (cool). */
export function depthColor(depthKm) {
    const d = num(depthKm, 0)
    if (d < 10) return '#d7191c'
    if (d < 30) return '#fdae61'
    if (d < 70) return '#ffffbf'
    if (d < 300) return '#abd9e9'
    return '#2c7bb6'
}

export default {
    DEFAULT_ENDPOINT,
    buildQueryUrl,
    normalizeEvents,
    temporalNeighbors,
    eventTime,
    ringRadiusMeters,
    depthColor,
}
