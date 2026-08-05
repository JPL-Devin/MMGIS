/**
 * Pure logic for the seismic:summary interaction — no MMGIS singletons, no
 * Leaflet, so it is unit testable in Node (the handler itself is not: it imports
 * `L_`).
 */

const num = (v, fallback) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback)

export function eventTime(feature) {
    const p = feature?.properties || {}
    const t = num(p.time, null)
    if (t != null) return t
    const parsed = p.time_iso ? Date.parse(p.time_iso) : NaN
    return Number.isNaN(parsed) ? null : parsed
}

export function eventId(feature) {
    return feature?.properties?.id ?? feature?.id ?? null
}

/**
 * Events within `windowMinutes` of `feature`, nearest in time first.
 * @returns {Array<{feature: Object, dtMinutes: number}>}
 */
export function temporalNeighbors(features, feature, windowMinutes = 60) {
    const t0 = eventTime(feature)
    if (t0 == null) return []
    const windowMs = Math.max(0, windowMinutes) * 60000
    const id = eventId(feature)
    return (features || [])
        .filter((f) => f !== feature && (id == null || eventId(f) !== id))
        .map((f) => ({ feature: f, dt: Math.abs((eventTime(f) ?? Infinity) - t0) }))
        .filter((n) => Number.isFinite(n.dt) && n.dt <= windowMs)
        .sort((a, b) => a.dt - b.dt)
        .map((n) => ({ feature: n.feature, dtMinutes: n.dt / 60000 }))
}

/**
 * The popup body: the event, then how many others happened near it in time.
 * @returns {string} HTML.
 */
export function summaryHtml(feature, neighbors, windowMinutes) {
    const p = feature?.properties || {}
    const mag = num(p.magnitude ?? p.mag, null)
    const depth = num(p.depth_km, null)
    const when = p.time_iso || (eventTime(feature) ? new Date(eventTime(feature)).toISOString() : '—')
    const rows = [
        ['Magnitude', mag == null ? '—' : mag.toFixed(1)],
        ['Depth', depth == null ? '—' : `${depth.toFixed(1)} km`],
        ['Time (UTC)', when],
        ['Place', p.place || p.title || '—'],
        [
            `Within ±${windowMinutes} min`,
            neighbors.length
                ? `${neighbors.length} other event${neighbors.length === 1 ? '' : 's'} (nearest ${neighbors[0].dtMinutes.toFixed(1)} min)`
                : 'no other events',
        ],
    ]
    return [
        `<div class="seismicSummary"><b>${escapeHtml(p.title || 'Seismic event')}</b>`,
        '<table>',
        ...rows.map(
            ([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(String(v))}</td></tr>`
        ),
        '</table></div>',
    ].join('')
}

export function escapeHtml(s) {
    return String(s).replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    )
}

export default { eventTime, eventId, temporalNeighbors, summaryHtml, escapeHtml }
