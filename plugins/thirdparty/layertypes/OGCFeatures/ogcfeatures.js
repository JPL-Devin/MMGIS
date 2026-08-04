/**
 * OGC API - Features layer type (`ogcfeatures`).
 *
 * `extends: "vector"` — an OGC API - Features `/items` response *is* a GeoJSON
 * FeatureCollection, so everything about drawing, picking, filtering and the
 * globe is already Vector's job. All this type owns is the `config` surface:
 * turning an OGC API url (landing page, `/collections`, or a single collection)
 * into the concrete GeoJSON request core should fetch.
 *
 * Configure with:
 *   url        an OGC API - Features landing page, `.../collections`, a single
 *              `.../collections/<id>`, or an explicit `.../items` url
 *   variables.ogcapi.limit     page size (default 1000)
 *   variables.ogcapi.bbox      "minx,miny,maxx,maxy" filter
 *   variables.ogcapi.datetime  RFC 3339 instant or interval
 *   variables.ogcapi.crs       output CRS uri (server must advertise it)
 *   variables.ogcapi.filter    CQL2-text filter (server must support it)
 */

const DEFAULT_LIMIT = 1000

const ITEMS_RE = /\/items(\/|\?|$)/i
const COLLECTION_RE = /\/collections\/[^/?#]+\/?$/i
const COLLECTIONS_RE = /\/collections\/?(\?|#|$)/i

const trimSlash = (url) => String(url).replace(/\/+$/, '')

const splitQuery = (url) => {
    const i = String(url).indexOf('?')
    return i === -1
        ? { base: url, query: '' }
        : { base: url.slice(0, i), query: url.slice(i + 1) }
}

/**
 * Merge params into a url without clobbering ones the author wrote themselves.
 */
function withParams(url, params) {
    const { base, query } = splitQuery(url)
    const present = new Set(
        query
            .split('&')
            .filter((p) => p !== '')
            .map((p) => p.split('=')[0].toLowerCase())
    )
    const added = []
    for (const key in params) {
        const value = params[key]
        if (value == null || value === '') continue
        if (present.has(key.toLowerCase())) continue
        added.push(`${key}=${encodeURIComponent(value)}`)
    }
    const parts = [query, ...added].filter((p) => p !== '')
    return parts.length ? `${base}?${parts.join('&')}` : base
}

function ogcVars(layerObj) {
    return (layerObj && layerObj.variables && layerObj.variables.ogcapi) || {}
}

/**
 * The GeoJSON items request for a collection url.
 */
function itemsUrl(url, layerObj) {
    const vars = ogcVars(layerObj)
    const base = ITEMS_RE.test(url) ? url : `${trimSlash(url)}/items`
    return withParams(base, {
        f: 'json',
        limit: vars.limit || DEFAULT_LIMIT,
        bbox: vars.bbox,
        datetime: vars.datetime,
        crs: vars.crs,
        filter: vars.filter,
    })
}

async function fetchJson(url) {
    const res = await fetch(withParams(url, { f: 'json' }), {
        headers: { Accept: 'application/json' },
    })
    if (!res.ok)
        throw new Error(`OGCFeatures: ${res.status} ${res.statusText} — ${url}`)
    return res.json()
}

/**
 * A landing page or `/collections` url describes many layers, so it expands
 * into a `header` whose sublayers are the service's collections. A url that
 * already names one collection (or its items) is left alone.
 */
async function expand(layerObj) {
    const url = layerObj.url || ''
    if (url === '' || ITEMS_RE.test(url) || COLLECTION_RE.test(url))
        return layerObj

    const collectionsUrl = COLLECTIONS_RE.test(url)
        ? url
        : `${trimSlash(url)}/collections`

    let collections
    try {
        const data = await fetchJson(collectionsUrl)
        collections = Array.isArray(data.collections) ? data.collections : null
    } catch (err) {
        console.warn(err)
        return layerObj
    }
    if (!collections || collections.length === 0) return layerObj

    const root = trimSlash(splitQuery(collectionsUrl).base)
    const sublayers = collections.map((c, i) => {
        const self = (c.links || []).find(
            (l) => /^self$/i.test(l.rel || '') && l.href
        )
        const uuid = `${layerObj.uuid}-${i}`
        return Object.assign({}, layerObj, {
            url: self ? self.href : `${root}/${c.id}`,
            display_name: c.title || c.id,
            description: c.description || layerObj.description,
            uuid,
            name: uuid,
            sublayers: undefined,
        })
    })

    return Object.assign({}, layerObj, {
        type: 'header',
        sublayers,
        display_name: layerObj.display_name || 'OGC API - Features',
    })
}

/**
 * Vector's own machinery keys off a few layer fields; give this type the
 * defaults an OGC API collection implies rather than making every mission
 * repeat them.
 */
function normalize(layerObj) {
    if (layerObj.type !== 'ogcfeatures') return layerObj
    layerObj.variables = layerObj.variables || {}
    layerObj.variables.ogcapi = Object.assign(
        { limit: DEFAULT_LIMIT },
        layerObj.variables.ogcapi
    )
    return layerObj
}

/**
 * Last word on the url core fetches: always a GeoJSON `/items` request.
 */
function resolveUrl(url, layerObj) {
    if (url == null || url === '') return url
    return itemsUrl(url, layerObj)
}

export const __test = { itemsUrl, withParams, expand, normalize, resolveUrl }

export default {
    config: { expand, normalize, resolveUrl },
}
