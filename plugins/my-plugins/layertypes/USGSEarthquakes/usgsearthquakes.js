/**
 * USGSEarthquakes layer type.
 *
 * A single-file layertype that `extends: "vector"`, so all drawing, picking,
 * filtering, time-scrub and both globes come from Vector unchanged. The only
 * surfaces it replaces are:
 *
 *   - `config.expand`  — supply sensible defaults (a working URL, viewport
 *                        querying on, a magnitude-driven point style) so a
 *                        mission author can add the layer with just a name.
 *   - `source.fetch`   — acquire the data from the USGS FDSN Event web service,
 *                        which core cannot fetch as a plain URL because the
 *                        query has to be built from the current viewport (bbox)
 *                        and time window on every request.
 *
 * See plugins/core/layertypes/README.md → "The non-render surfaces".
 */

const DEFAULT_ENDPOINT = 'https://earthquake.usgs.gov/fdsnws/event/1/query'

// Rough USGS "magnitude → color" ramp, greens/yellows/reds by severity.
function magColor(mag) {
    if (mag == null || isNaN(mag)) return '#888888'
    if (mag < 2) return '#4daf4a'
    if (mag < 4) return '#ffff33'
    if (mag < 5) return '#ff7f00'
    if (mag < 6) return '#e41a1c'
    return '#8e0152'
}

// A per-feature radius that grows with magnitude.
function magRadius(mag) {
    if (mag == null || isNaN(mag)) return 3
    return Math.max(3, Math.round(2 + mag * 2.2))
}

/**
 * config.expand — turn a bare `{ type: 'usgsearthquakes', name }` entry into a
 * fully-defaulted vector layer. Runs at mission-config parse time.
 */
function expand(layerObj) {
    layerObj.url = layerObj.url || DEFAULT_ENDPOINT
    layerObj.variables = layerObj.variables || {}
    const v = layerObj.variables

    // A source-driven type must default dynamicExtent itself (README: the
    // mission author shouldn't have to know to set it).
    if (v.dynamicExtent == null) v.dynamicExtent = true
    if (v.limit == null) v.limit = 1000
    if (v.minmagnitude == null) v.minmagnitude = 2.5

    // Point styling handled by Vector's own renderer via `style`/`shape`.
    layerObj.style = layerObj.style || {}
    if (layerObj.shape == null) layerObj.shape = 'circle'

    // A radius/color that reads magnitude off each feature's properties.
    layerObj.variables.markerAttachments = layerObj.variables.markerAttachments || {}

    return layerObj
}

/**
 * source.fetch — build and run the FDSN query, normalize the response so Vector
 * can style it, and return a GeoJSON FeatureCollection (or null to leave the
 * layer untouched).
 */
async function fetch(layerObj, ctx = {}) {
    const v = layerObj.variables || {}
    const endpoint = ctx.url || layerObj.url || DEFAULT_ENDPOINT

    let url
    try {
        url = new URL(endpoint)
    } catch (e) {
        throw new Error(`USGSEarthquakes: invalid endpoint "${endpoint}"`)
    }

    url.searchParams.set('format', 'geojson')
    url.searchParams.set('orderby', 'time')
    url.searchParams.set('limit', String(v.limit ?? 1000))
    if (v.minmagnitude != null && v.minmagnitude !== '')
        url.searchParams.set('minmagnitude', String(v.minmagnitude))

    // Viewport (dynamic extent) → FDSN bounding box.
    if (ctx.view) {
        url.searchParams.set('minlongitude', String(ctx.view.minx))
        url.searchParams.set('maxlongitude', String(ctx.view.maxx))
        url.searchParams.set('minlatitude', String(ctx.view.miny))
        url.searchParams.set('maxlatitude', String(ctx.view.maxy))
    }

    // Time bar → FDSN starttime/endtime.
    if (ctx.time && ctx.time.requery) {
        if (ctx.time.start) url.searchParams.set('starttime', ctx.time.start)
        if (ctx.time.end) url.searchParams.set('endtime', ctx.time.end)
    }

    const res = await window.fetch(url.toString(), {
        headers: { Accept: 'application/geo+json' },
    })
    if (!res.ok) throw new Error(`USGSEarthquakes: ${res.status} ${res.statusText}`)

    const fc = await res.json()
    const features = Array.isArray(fc?.features) ? fc.features : []

    // Flatten the fields Vector's styling/popups read into feature.properties.
    for (const f of features) {
        const p = f.properties || (f.properties = {})
        const mag = typeof p.mag === 'number' ? p.mag : parseFloat(p.mag)
        const depth = Array.isArray(f.geometry?.coordinates)
            ? f.geometry.coordinates[2]
            : undefined
        p.magnitude = mag
        p.depth_km = depth
        p.usgs_id = f.id
        // Per-feature style properties Vector understands.
        p.fillColor = magColor(mag)
        p.color = magColor(mag)
        p.radius = magRadius(mag)
        p.weight = 1
        p.fillOpacity = 0.8
    }

    return { type: 'FeatureCollection', features }
}

export default {
    config: { expand },
    source: { fetch },
}
