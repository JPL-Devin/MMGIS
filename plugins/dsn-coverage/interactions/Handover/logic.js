/**
 * Handover's decisions, with nothing imported from `src/essence`, so it is the
 * part a Node unit test can cover.
 */
import { handoverCandidates, stationOf } from '../../lib/coverage'

/**
 * Which other stations in the same layer overlap the clicked one.
 *
 * @param {object|null} feature  the clicked station
 * @param {object|null} geojson  the host layer's features
 * @param {object|null} config   this interaction's settings on the layer
 * @param {object} stationProps  property names, from the layer's
 *   `variables.groundStation` (the layer type normalizes them there)
 * @returns {{station: object, candidates: Array}|null}
 */
export function handoversFor(feature, geojson, config, stationProps = {}) {
    if (feature == null) return null
    const settings = { ...stationProps, ...(config || {}) }
    const target = stationOf(feature, settings)
    if (!Number.isFinite(target.lat) || !Number.isFinite(target.lng))
        return null

    const others = (geojson?.features || [])
        .filter((f) => f.geometry?.type === 'Point')
        .map((f) => stationOf(f, settings))

    return {
        station: target,
        candidates: handoverCandidates(target, others, settings),
    }
}

/** One line per candidate, for the message the handler shows. */
export function summarize(result) {
    if (result == null) return null
    if (result.candidates.length === 0)
        return `${result.station.name}: no station overlaps its coverage.`
    return [
        `${result.station.name} can hand over to:`,
        ...result.candidates.map(
            (c) =>
                `• ${c.name}${c.band ? ` (${c.band})` : ''} — ${Math.round(
                    c.distanceKm
                )} km away, ${Math.round(c.overlapKm)} km of overlap`
        ),
    ].join('\n')
}
