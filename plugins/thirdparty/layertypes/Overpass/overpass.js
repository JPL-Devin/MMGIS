/**
 * Overpass layer type (`overpass`) — live OpenStreetMap features.
 *
 * `extends: "vector"`, so drawing, picking, filtering and both globes are
 * Vector's. All this type owns is `source.fetch`: an Overpass query is a
 * **POST body** in the Overpass QL language, the response is OSM JSON (not
 * GeoJSON), a large area has to be split into several requests and stitched,
 * and a private instance wants headers — none of which a url string can say.
 *
 * Configure with:
 *   url                              an Overpass interpreter endpoint
 *                                    (default https://overpass-api.de/api/interpreter)
 *   variables.overpass.query         Overpass QL, with `{{bbox}}` where the view goes
 *   variables.overpass.tiles         split the view into an NxN grid of requests (default 1)
 *   variables.overpass.timeout       Overpass server-side timeout, seconds (default 25)
 *   variables.overpass.maxFeatures   stop stitching once this many features are in (default 20000)
 *   variables.overpass.headers       extra request headers, e.g. { Authorization: "Bearer …" }
 *   variables.dynamicExtent          core's viewport re-query; defaulted on here
 */

const DEFAULT_ENDPOINT = 'https://overpass-api.de/api/interpreter'
const DEFAULT_QUERY = 'nwr["natural"="peak"]({{bbox}});'
const DEFAULT_TIMEOUT = 25
const DEFAULT_MAX_FEATURES = 20000
const BBOX_TOKEN = /\{\{\s*bbox\s*\}\}/g

const vars = (layerObj) =>
    (layerObj && layerObj.variables && layerObj.variables.overpass) || {}

/** Overpass writes bboxes south,west,north,east — the opposite of GeoJSON. */
const bboxOf = (view) =>
    view == null
        ? null
        : [view.miny, view.minx, view.maxy, view.maxx]
              .map((n) => Number(n).toFixed(6))
              .join(',')

/** The whole planet, for a layer with no dynamic extent. */
const WORLD = '-90,-180,90,180'

/**
 * Split a view into an NxN grid of Overpass bboxes. Overpass has no paging: the
 * way to get more than one request's worth of data is to ask for less area at a
 * time, which is why this is stitching rather than pagination.
 */
function tileBBoxes(view, n) {
    if (view == null || !(n > 1)) return [bboxOf(view) || WORLD]
    const out = []
    const dx = (view.maxx - view.minx) / n
    const dy = (view.maxy - view.miny) / n
    for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
            out.push(
                bboxOf({
                    minx: view.minx + i * dx,
                    maxx: view.minx + (i + 1) * dx,
                    miny: view.miny + j * dy,
                    maxy: view.miny + (j + 1) * dy,
                })
            )
    return out
}

/**
 * The POST body. Overpass QL is a program, not query parameters: the settings
 * line carries the output format and timeout, the author's statements carry the
 * filters, and `out geom` is what makes ways come back with coordinates instead
 * of node ids we would then have to resolve ourselves.
 */
function buildQuery(layerObj, bbox) {
    const v = vars(layerObj)
    const statements = (v.query || DEFAULT_QUERY).replace(BBOX_TOKEN, bbox)
    const settings = `[out:json][timeout:${v.timeout || DEFAULT_TIMEOUT}]`
    return `${settings};\n${statements}\nout tags geom qt;`
}

const isClosed = (geometry) => {
    if (geometry.length < 4) return false
    const a = geometry[0]
    const b = geometry[geometry.length - 1]
    return a.lat === b.lat && a.lon === b.lon
}

/** OSM tags that mean a closed way is an area rather than a ring-shaped line. */
const AREA_TAGS = [
    'area',
    'building',
    'landuse',
    'leisure',
    'natural',
    'amenity',
    'water',
    'waterway',
    'place',
    'boundary',
]

const looksLikeArea = (tags = {}) =>
    tags.area === 'yes' ||
    (tags.area !== 'no' && AREA_TAGS.some((t) => tags[t] != null))

/**
 * OSM JSON → GeoJSON. Nodes are points; ways carry `geometry` because of
 * `out geom` and become polygons when they are closed and tagged like an area,
 * lines otherwise; relations are returned as a MultiLineString of their member
 * ways, which is enough to see them.
 */
function osmToGeoJSON(elements) {
    const features = []
    for (const el of elements || []) {
        const properties = Object.assign({ osm_id: el.id, osm_type: el.type }, el.tags)
        if (el.type === 'node' && el.lat != null) {
            features.push({
                type: 'Feature',
                properties,
                geometry: { type: 'Point', coordinates: [el.lon, el.lat] },
            })
        } else if (el.type === 'way' && Array.isArray(el.geometry)) {
            const coordinates = el.geometry
                .filter((p) => p != null)
                .map((p) => [p.lon, p.lat])
            if (coordinates.length < 2) continue
            const area = isClosed(el.geometry) && looksLikeArea(el.tags)
            features.push({
                type: 'Feature',
                properties,
                geometry: area
                    ? { type: 'Polygon', coordinates: [coordinates] }
                    : { type: 'LineString', coordinates },
            })
        } else if (el.type === 'relation' && Array.isArray(el.members)) {
            const coordinates = el.members
                .filter((m) => Array.isArray(m.geometry) && m.geometry.length > 1)
                .map((m) => m.geometry.map((p) => [p.lon, p.lat]))
            if (coordinates.length === 0) continue
            features.push({
                type: 'Feature',
                properties,
                geometry: { type: 'MultiLineString', coordinates },
            })
        }
    }
    return features
}

async function postQuery(endpoint, query, headers) {
    const res = await window.fetch(endpoint, {
        method: 'POST',
        headers: Object.assign(
            { 'Content-Type': 'application/x-www-form-urlencoded' },
            headers || {}
        ),
        body: `data=${encodeURIComponent(query)}`,
    })
    if (res.status === 429 || res.status === 504)
        throw new Error(
            `Overpass is rate-limiting or timing out (${res.status}) — raise variables.overpass.tiles or narrow the query`
        )
    if (!res.ok) throw new Error(`Overpass ${res.status} ${res.statusText}`)
    const body = await res.json()
    if (body.remark) console.warn(`Overpass remark: ${body.remark}`)
    return body.elements || []
}

/**
 * `source.fetch` — core owns when to ask (debounce, zoom gate, staleness, the
 * extent itself); this owns the request. Sequential on purpose: Overpass is a
 * donated public service that rate-limits parallel clients.
 */
async function fetch(layerObj, ctx = {}) {
    const v = vars(layerObj)
    const endpoint = ctx.url || layerObj.url || DEFAULT_ENDPOINT
    const bboxes = tileBBoxes(ctx.view, Number(v.tiles) || 1)
    const maxFeatures = Number(v.maxFeatures) || DEFAULT_MAX_FEATURES

    const seen = new Set()
    const features = []
    for (const bbox of bboxes) {
        const elements = await postQuery(
            endpoint,
            buildQuery(layerObj, bbox),
            v.headers
        )
        // Tiles overlap on their shared edges, and a way crossing one is
        // returned by both, so dedupe on the OSM identity.
        for (const feature of osmToGeoJSON(elements)) {
            const key = `${feature.properties.osm_type}/${feature.properties.osm_id}`
            if (seen.has(key)) continue
            seen.add(key)
            features.push(feature)
        }
        if (features.length >= maxFeatures) {
            console.warn(
                `Overpass: stopped at ${features.length} features (variables.overpass.maxFeatures)`
            )
            break
        }
    }

    return { type: 'FeatureCollection', features }
}

/**
 * OSM features have no MMGIS styling, and an unstyled vector layer is invisible
 * on a dark basemap, so give the layer a default it can override.
 */
function normalize(layerObj) {
    layerObj.variables = layerObj.variables || {}
    // An Overpass query is only sane over a bounded view, so this type opts
    // into core's dynamic-extent policy by default.
    if (layerObj.variables.dynamicExtent == null)
        layerObj.variables.dynamicExtent = true
    layerObj.variables.overpass = Object.assign(
        {
            query: DEFAULT_QUERY,
            tiles: 1,
            timeout: DEFAULT_TIMEOUT,
            maxFeatures: DEFAULT_MAX_FEATURES,
        },
        layerObj.variables.overpass
    )
    if (layerObj.style == null)
        layerObj.style = {
            color: '#e8590c',
            fillColor: '#f59f00',
            weight: 2,
            fillOpacity: 0.4,
            radius: 5,
        }
    return layerObj
}

export const __test = {
    buildQuery,
    tileBBoxes,
    osmToGeoJSON,
    normalize,
    fetch,
    bboxOf,
}

export default {
    source: { fetch },
    config: { normalize },
}
