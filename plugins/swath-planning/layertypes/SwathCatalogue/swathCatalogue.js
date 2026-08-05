/**
 * SwathCatalogue layer type — extends `vector`.
 *
 * Its data comes from a planning catalogue that only answers POST, pages its
 * results, and is queried against the current viewport. Only the `source` and
 * `config` surfaces differ from `vector`; drawing, picking, filtering and both
 * globes are inherited.
 */
import { conflictCountsFor } from '../../lib/swathGeometry'

const DEFAULTS = {
    endpoint: 'api/swathCatalogueAPI/search',
    pageSize: 50,
    maxPages: 10,
}

/** Absolute url for a possibly mission-relative endpoint. */
const endpointOf = (layerObj) => {
    const raw = layerObj?.variables?.swathCatalogue?.endpoint || DEFAULTS.endpoint
    if (/^https?:\/\//.test(raw) || raw.startsWith('/')) return raw
    const root = window.mmgisglobal?.ROOT_PATH || ''
    return `${root.replace(/\/$/, '')}/${raw}`
}

const bboxOf = (ctx) =>
    ctx?.view
        ? [ctx.view.minx, ctx.view.miny, ctx.view.maxx, ctx.view.maxy]
        : [-180, -85, 180, 85]

/**
 * Page through the catalogue for the current extent.
 * @param {Object} layerObj the layer's config object
 * @param {Object} ctx core's acquisition context (`view`, `time`, `trigger`, …)
 * @returns {Promise<Object|null>} a FeatureCollection, or null to leave the layer
 */
async function fetch(layerObj, ctx) {
    const vars = layerObj?.variables?.swathCatalogue || {}
    const url = endpointOf(layerObj)
    const pageSize = Number(vars.pageSize) || DEFAULTS.pageSize
    const maxPages = Number(vars.maxPages) || DEFAULTS.maxPages
    const bbox = bboxOf(ctx)
    const time =
        ctx?.time?.requery && ctx.time.start && ctx.time.end
            ? { start: ctx.time.start, end: ctx.time.end }
            : null

    const features = []
    let page = 0
    let pages = 1
    while (page < pages && page < maxPages) {
        const res = await window.fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bbox, page, pageSize, time }),
        })
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        const body = await res.json()
        ;(body.features || []).forEach((f) => features.push(f))
        pages = Number(body.pages) || 1
        page += 1
    }

    // Precomputed so the click interaction and any styling read a property
    // rather than recomputing geometry: `style: { "color": "prop-conflicts" }`.
    conflictCountsFor(features).forEach((count, i) => {
        features[i].properties = features[i].properties || {}
        features[i].properties.conflicts = count
    })

    return { type: 'FeatureCollection', features }
}

/**
 * A viewport-driven source is useless without dynamic extent, and that is a
 * *layer* setting rather than a type capability, so the type defaults it.
 */
function expand(layerObj) {
    layerObj.variables = layerObj.variables || {}
    if (layerObj.variables.dynamicExtent == null)
        layerObj.variables.dynamicExtent = true
    return layerObj
}

const SwathCatalogue = {
    source: { fetch },
    config: { expand },
}

export default SwathCatalogue
