/**
 * Pure selection of the events in a time window, shared by the tool and testable
 * in Node (nothing from `src/essence` here).
 */
import {
    inWindow,
    DURATION_PROP,
    DEFAULT_START_PROP,
    DEFAULT_END_PROP,
} from './eventTime'

/**
 * @param {Array<{layerName: string, layerObj: object, geojson: object}>} layers
 * @param {string|null} windowStart ISO
 * @param {string|null} windowEnd ISO
 */
export function eventsInWindow(layers, windowStart, windowEnd) {
    const rows = []
    ;(layers || []).forEach(({ layerName, layerObj, geojson }) => {
        const startProp = layerObj?.time?.startProp || DEFAULT_START_PROP
        const endProp = layerObj?.time?.endProp || DEFAULT_END_PROP
        ;(geojson?.features || []).forEach((f, i) => {
            const p = f.properties || {}
            if (!inWindow(p[startProp], p[endProp], windowStart, windowEnd)) return
            rows.push({
                layerName,
                id: p.id ?? i,
                label: p.name ?? p.title ?? p.id ?? `Event ${i + 1}`,
                start: p[startProp],
                end: p[endProp],
                durationSec: parseFloat(p[DURATION_PROP]) || 0,
            })
        })
    })
    return rows.sort((a, b) => new Date(a.start) - new Date(b.start))
}
