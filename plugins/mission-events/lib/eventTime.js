/**
 * Facts the mission-events plugins share. Nothing from `src/essence` is imported
 * here, so this module is importable in a Node unit test and by every family.
 */

export const DEFAULT_START_PROP = 'start_time'
export const DEFAULT_END_PROP = 'end_time'

/** The property MissionEvents.source.fetch stamps a duration onto. */
export const DURATION_PROP = 'durationSec'

const ms = (v) => {
    if (v == null || v === '') return null
    const t = new Date(v).getTime()
    return Number.isFinite(t) ? t : null
}

/** Duration of one event in seconds; 0 when it is a single point in time. */
export function eventDurationSec(start, end) {
    const s = ms(start)
    const e = ms(end)
    if (s == null) return 0
    if (e == null) return 0
    return Math.max(0, (e - s) / 1000)
}

/**
 * How far through its own duration an event is at `now`, 0..1. A zero-duration
 * event is 1 once it has happened. Null before it starts.
 */
export function eventProgress(start, end, now) {
    const s = ms(start)
    const n = ms(now)
    if (s == null || n == null || n < s) return null
    const e = ms(end)
    if (e == null || e <= s) return 1
    return Math.min(1, (n - s) / (e - s))
}

/** True when [start,end] intersects the window [wStart,wEnd]. */
export function inWindow(start, end, wStart, wEnd) {
    const s = ms(start)
    if (s == null) return false
    const e = ms(end) ?? s
    const ws = ms(wStart)
    const we = ms(wEnd)
    if (ws == null || we == null) return true
    return e >= ws && s <= we
}

/**
 * The time window EventSeek moves the clock to for one event: the event's own
 * span, padded by `padSec` on both sides, with the playhead at its start.
 */
export function windowForEvent(start, end, padSec = 300) {
    const s = ms(start)
    if (s == null) return null
    const e = ms(end) ?? s
    const pad = (Number.isFinite(parseFloat(padSec)) ? parseFloat(padSec) : 300) * 1000
    return {
        startTime: new Date(s - pad).toISOString(),
        endTime: new Date(e + pad).toISOString(),
        currentTime: new Date(s).toISOString(),
    }
}
