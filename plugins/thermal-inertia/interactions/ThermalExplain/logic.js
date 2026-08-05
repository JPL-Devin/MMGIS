/**
 * ThermalExplain's decisions, with nothing imported from `src/essence`.
 *
 * The handler beside this file touches Leaflet/`L_` and so cannot be imported in
 * a Node test; this pure module is what the unit test covers. It shares the
 * container's inertia model with the layer type and the attachment, so a clicked
 * feature is explained with exactly the number the shading used.
 */
import { inertiaOfFeature, DEFAULTS } from '../../lib/thermalInertia'

/**
 * @param {object|null} feature  The clicked GeoJSON feature, if there was one.
 * @param {object|null} config   This interaction's settings on the layer (from
 *   the layer type's defaultInteractions, or an admin). Null/partial, so the
 *   defaults live here and in the shared lib.
 * @returns {{inertia:number, dayTemp:number, nightTemp:number,
 *   amplitude:number, dayTempProp:string, nightTempProp:string, scale:number,
 *   text:string}|null} null when there is nothing to explain.
 */
export function explain(feature, config) {
    if (feature == null) return null
    const cfg = config || {}
    const dayTempProp = cfg.dayTempProp || DEFAULTS.dayTempProp
    const nightTempProp = cfg.nightTempProp || DEFAULTS.nightTempProp
    const scale = Number.isFinite(parseFloat(cfg.scale))
        ? parseFloat(cfg.scale)
        : DEFAULTS.scale

    const derived = inertiaOfFeature(feature, {
        dayTempProp,
        nightTempProp,
        scale,
    })
    if (derived == null) return null

    const round = (n) => Math.round(n * 10) / 10
    const text =
        `Thermal inertia ≈ ${round(derived.inertia)} ` +
        `(= ${scale} / ΔT, ΔT = ${round(derived.dayTemp)}° day − ` +
        `${round(derived.nightTemp)}° night = ${round(derived.amplitude)}°). ` +
        `A larger day/night swing means lower inertia.`

    return {
        inertia: derived.inertia,
        dayTemp: derived.dayTemp,
        nightTemp: derived.nightTemp,
        amplitude: derived.amplitude,
        dayTempProp,
        nightTempProp,
        scale,
        text,
    }
}
