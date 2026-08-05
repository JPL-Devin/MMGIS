/**
 * RadarDepthProbe's decisions, with nothing imported from `src/essence`.
 *
 * The depth maths itself lives with the layer type
 * (`../../layertypes/Radargram/lib/radargram.js`) because the curtain, the
 * interface markers and this probe must agree on it. Importing across plugin
 * containers is a relative path — there is no alias for "another plugin" — so
 * see the report: this is the seam I am least sure about.
 */
import { probe } from '../../layertypes/Radargram/lib/radargram'

/**
 * @param {object|null} feature the clicked GeoJSON feature, if any
 * @param {{lng:number, lat:number}|null} lnglat where the click landed
 * @param {object|null} config this interaction's settings on the layer
 * @returns {{message: string, probe: object}|null} null when there is nothing to say
 */
export function decide(feature, lnglat, config) {
    if (feature == null || lnglat == null) return null
    const result = probe(feature, lnglat, config)
    if (result == null || !Number.isFinite(result.depthMeters)) return null

    const depth = Math.round(result.depthMeters)
    const detail = result.estimated
        ? 'depth axis (no two-way time on this feature)'
        : `${result.twtNs} ns two-way`
    return {
        message: `Trace ${result.traceIndex} · ${depth} m below surface (${detail})`,
        probe: result,
    }
}
