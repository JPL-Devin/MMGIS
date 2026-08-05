/**
 * Pure helpers for the TelemetryScrub interaction — dependency-free so they can
 * be unit-tested in Node (the `use` handler that touches TimeControl / F_ can't).
 */

export function parseTime(v) {
    if (v == null || v === '') return null
    if (typeof v === 'number') return Number.isFinite(v) ? v : null
    const t = Date.parse(v)
    return Number.isNaN(t) ? null : t
}

const defaultGetIn = (obj, path) => {
    if (obj == null || path == null) return undefined
    return String(path)
        .split('.')
        .reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

/** Epoch-ms timestamp a clicked feature represents (endProp, else startProp). */
export function readFeatureTime(feature, startProp, endProp, getIn = defaultGetIn) {
    const props = feature && feature.properties
    if (!props) return null
    let raw
    if (endProp) raw = getIn(props, endProp)
    if (raw == null && startProp) raw = getIn(props, startProp)
    return parseTime(raw)
}

const HOUR_MS = 60 * 60 * 1000

/**
 * Where the mission clock should move so the clicked feature is the playhead.
 * Preserves the current window's duration; `mode` places the window around the
 * timestamp:
 *   - 'center' (default): timestamp at the middle of the window
 *   - 'endAt': window ends at the timestamp (trailing window)
 *
 * @returns {{start:string, end:string, currentTime:string}} ISO strings.
 */
export function computeScrubWindow(currentStart, currentEnd, timestampMs, mode = 'center') {
    if (!Number.isFinite(timestampMs)) return null
    const s = parseTime(currentStart)
    const e = parseTime(currentEnd)
    const duration = s != null && e != null && e > s ? e - s : HOUR_MS

    let start
    let end
    if (mode === 'endAt') {
        end = timestampMs
        start = timestampMs - duration
    } else {
        start = timestampMs - duration / 2
        end = timestampMs + duration / 2
    }

    const iso = (ms) => new Date(ms).toISOString().split('.')[0] + 'Z'
    return { start: iso(start), end: iso(end), currentTime: iso(timestampMs) }
}
