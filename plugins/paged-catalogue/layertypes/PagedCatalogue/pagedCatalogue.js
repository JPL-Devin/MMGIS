/**
 * PagedCatalogue layer type — extends `vector`.
 *
 * A catalogue of millions of features served page-by-page from a slow endpoint.
 * The type is viewport-bound (dynamic extent) and draws features as each page
 * arrives via `ctx.emit`, honouring `ctx.signal` so panning/zooming away stops
 * pulling a viewport the user has left.
 *
 * Everything else — drawing, picking, styling, filtering, both globes — is
 * inherited from `vector`.
 */
import {
    DEFAULTS,
    buildPageUrl,
    tagPage,
    hasNextPage,
} from '../../lib/pageMath'

async function fetch(layerObj, ctx) {
    if (!ctx.url) return null

    const vars = layerObj.variables || {}
    const limit = vars.pageSize ?? DEFAULTS.pageSize
    const maxPages = vars.maxPages ?? DEFAULTS.maxPages

    const features = []
    for (let page = 0; page < maxPages; page++) {
        const res = await window.fetch(buildPageUrl(ctx.url, ctx.view, page, limit), {
            headers: { Accept: 'application/geo+json' },
            signal: ctx.signal,
        })
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        const fc = await res.json()

        features.push(...tagPage(fc.features || [], page))

        // Draw everything acquired so far (a fresh array — core keeps no
        // reference, and each emit replaces what is drawn).
        ctx.emit({ type: 'FeatureCollection', features: features.slice() })

        if (!hasNextPage(fc, limit)) break
    }

    // Every page was already emitted.
    return null
}

/**
 * A viewport-driven source only receives `ctx.view` when the layer opts into
 * dynamic extent, so default it here rather than assume the mission author set
 * it. `inherited` is the LAST argument core appends (after `layerObj`) — note
 * core passes NO `ctx` to config ops, unlike the README's extends example.
 */
function normalize(layerObj, inherited) {
    if (typeof inherited === 'function') inherited()
    layerObj.variables = layerObj.variables || {}
    if (layerObj.variables.dynamicExtent == null)
        layerObj.variables.dynamicExtent = true
    return layerObj
}

const PagedCatalogue = {
    source: { fetch },
    config: { normalize },
}

export default PagedCatalogue
