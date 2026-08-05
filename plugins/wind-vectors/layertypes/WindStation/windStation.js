/**
 * WindStation layer type — extends `vector`.
 *
 * Weather stations whose wind speed / direction / id live in feature properties
 * an admin picks per layer (Configure → Wind Properties). Drawing, picking,
 * filtering and both globes are inherited.
 */
import { resolveProps, toKnots } from '../../lib/wind'

/**
 * Fetch station GeoJSON and normalize the configured properties onto every
 * feature, so the inherited vector renderer and any style rules have a stable
 * `wv_speed_knots` to work with regardless of what the source called it.
 */
async function fetch(layerObj, ctx) {
    const res = await window.fetch(ctx.url, {
        headers: { Accept: 'application/geo+json' },
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    const geojson = await res.json()
    return annotate(geojson, layerObj?.variables?.windStation)
}

/**
 * @param {object} geojson FeatureCollection (or a bare array of features)
 * @param {object|null} config the layer's `variables.windStation`
 * @returns {object} the same collection, each feature carrying `wv_speed_knots`
 */
export function annotate(geojson, config) {
    const features = Array.isArray(geojson) ? geojson : geojson?.features
    if (!Array.isArray(features)) return geojson
    const { speedProp } = resolveProps(config)
    const units = config?.speedUnits || 'knots'
    for (const f of features) {
        if (f?.properties == null) continue
        const knots = toKnots(parseFloat(f.properties[speedProp]), units)
        if (isFinite(knots)) f.properties.wv_speed_knots = knots
    }
    return geojson
}

/**
 * Keep vector's normalization and add this type's own defaults.
 * `inherited` is handed to us because we declared an operation the parent has.
 */
function normalize(layerObj, ctx, inherited) {
    if (typeof inherited === 'function') inherited()
    layerObj.variables = layerObj.variables || {}
    layerObj.variables.windStation = {
        ...resolveProps(layerObj.variables.windStation),
        speedUnits: layerObj.variables.windStation?.speedUnits || 'knots',
    }
    return layerObj
}

const WindStation = {
    source: { fetch },
    config: { normalize },
}

export default WindStation
