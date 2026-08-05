/**
 * WindField layer type — extends `vector`.
 *
 * Surfaces only: `source.fetch` (normalizes an observations feed into the
 * property names the rest of the container agrees on) and `legend.derive`
 * (a speed ramp that comes from the render, not the config).
 */
import { speedCategory, CATEGORY_COLORS, num } from '../../lib/wind'

/** The property names this container standardises on. */
export const SPEED_PROP = 'windSpeed'
export const DIRECTION_PROP = 'windDirection'

export function normalizeFeatures(collection, layerObj) {
    const v = layerObj?.variables || {}
    const speedFrom = v.speedProp || SPEED_PROP
    const directionFrom = v.directionProp || DIRECTION_PROP
    const features = (collection?.features || []).map((f) => {
        const p = { ...(f.properties || {}) }
        p[SPEED_PROP] = num(p[speedFrom], 0)
        p[DIRECTION_PROP] = num(p[directionFrom], 0)
        p.windCategory = speedCategory(p[SPEED_PROP])
        return { ...f, properties: p }
    })
    return { type: 'FeatureCollection', features }
}

async function fetch(layerObj, ctx) {
    if (!ctx.url) return null
    const res = await window.fetch(ctx.url, {
        headers: { Accept: 'application/geo+json' },
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return normalizeFeatures(await res.json(), layerObj)
}

/** A category ramp; `styleMatching` also colours the features. */
function derive(layerObj) {
    layerObj._legend = Object.keys(CATEGORY_COLORS).map((category) => ({
        shape: 'circle',
        color: CATEGORY_COLORS[category],
        value: category,
        styleMatching: true,
        propertyName: 'windCategory',
        propertyValue: category,
    }))
    return true
}

const WindField = {
    source: { fetch },
    legend: { derive },
}

export default WindField
