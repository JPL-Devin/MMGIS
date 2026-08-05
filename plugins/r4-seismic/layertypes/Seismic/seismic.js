/**
 * Seismic layer type — a `vector` whose features come from a live FDSN event
 * service (USGS by default) bounded by the current view.
 *
 * Everything about drawing, picking, filtering and both globes is inherited
 * through `"extends": "vector"`; this plugin only owns where the data comes from
 * (`source.fetch`) and the defaults a seismic layer wants (`config.normalize`).
 */
import { buildQueryUrl, normalizeEvents, DEFAULT_ENDPOINT } from './lib/usgs'

const num = (v, fallback) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback)

/**
 * `source.fetch` — core owns the extent, debounce, staleness and layer update;
 * this is a pure "given this context, give me GeoJSON".
 */
async function fetch(layerObj, ctx) {
    const v = layerObj?.variables || {}
    const url = buildQueryUrl({
        endpoint: layerObj?.url || v.endpoint || DEFAULT_ENDPOINT,
        view: ctx?.view || null,
        time: ctx?.time || null,
        minMagnitude: num(v.minMagnitude, 2.5),
        limit: num(v.limit, 500),
    })

    const res = await window.fetch(url, { headers: { Accept: 'application/geo+json' } })
    if (!res.ok) throw new Error(`FDSN ${res.status} ${res.statusText}`)
    return normalizeEvents(await res.json())
}

/**
 * `config.normalize` — a seismic layer is viewport-driven and its magnitude
 * ring attachment is the point of the type, so both are defaulted here rather
 * than left for a mission author to discover. Anything already configured wins.
 */
function normalize(layerObj) {
    layerObj.variables = layerObj.variables || {}
    const v = layerObj.variables
    if (v.dynamicExtent !== false) v.dynamicExtent = true

    v.layerAttachments = v.layerAttachments || {}
    if (v.layerAttachments.magnitudeRings == null)
        v.layerAttachments.magnitudeRings = { enabled: true }

    layerObj.style = {
        color: 'prop-magnitude',
        weight: 1,
        fillOpacity: 0.7,
        radius: 4,
        ...(layerObj.style || {}),
    }
    return layerObj
}

export default {
    source: { fetch },
    config: { normalize },
}
