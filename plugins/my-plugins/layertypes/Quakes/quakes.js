/**
 * Quakes layer type — time-varying earthquake feed from the USGS FDSN event API.
 *
 * It is a `vector` that gets its data from somewhere core can't fetch (a query
 * API keyed on the global time window and, optionally, the current view), so it
 * declares only the non-render surfaces that differ and inherits all drawing,
 * picking, filtering and both globes from `vector` via `extends`.
 *
 *   source.time  -> re-query USGS for the active [start, end] window
 *   legend.derive -> a magnitude color ramp built from what was actually fetched
 *
 * See plugins/core/layertypes/README.md.
 */

const USGS_QUERY = 'https://earthquake.usgs.gov/fdsnws/event/1/query'

// Magnitude -> color, low to high. Also drives the derived legend.
const MAG_BUCKETS = [
    { min: 6, color: '#a50f15', label: 'M ≥ 6' },
    { min: 5, color: '#de2d26', label: 'M 5–6' },
    { min: 4, color: '#fb6a4a', label: 'M 4–5' },
    { min: 3, color: '#fcae91', label: 'M 3–4' },
    { min: -Infinity, color: '#fee5d9', label: 'M < 3' },
]

const colorForMag = (m) => {
    for (const b of MAG_BUCKETS) if (m >= b.min) return b.color
    return MAG_BUCKETS[MAG_BUCKETS.length - 1].color
}

const iso = (d) => new Date(d).toISOString().split('.')[0] + 'Z'

async function fetch(layerObj, ctx = {}) {
    const v = layerObj.variables || {}
    const url = new URL(USGS_QUERY)
    url.searchParams.set('format', 'geojson')
    url.searchParams.set('limit', v.maxFeatures ?? 2000)
    url.searchParams.set('orderby', 'time')
    if (v.minMagnitude != null)
        url.searchParams.set('minmagnitude', v.minMagnitude)

    // Time-varying: honor the active global time window.
    if (ctx.time && ctx.time.start && ctx.time.end) {
        url.searchParams.set('starttime', iso(ctx.time.start))
        url.searchParams.set('endtime', iso(ctx.time.end))
    }

    // Dynamic extent: limit to what's in view when core asks for a view request.
    if (ctx.view) {
        url.searchParams.set('minlatitude', ctx.view.miny)
        url.searchParams.set('maxlatitude', ctx.view.maxy)
        url.searchParams.set('minlongitude', ctx.view.minx)
        url.searchParams.set('maxlongitude', ctx.view.maxx)
    }

    const res = await window.fetch(url.toString(), {
        headers: { Accept: 'application/geo+json' },
    })
    if (!res.ok) throw new Error(`USGS ${res.status} ${res.statusText}`)
    const geojson = await res.json()

    // Give every feature a per-feature style so the vector render colors it by
    // magnitude, and stash the data so legend.derive can build a ramp from what
    // actually came back rather than from config.
    const feats = geojson.features || []
    for (const f of feats) {
        const mag = f.properties?.mag
        const color = colorForMag(mag ?? 0)
        f.properties = f.properties || {}
        f.properties.style = {
            color,
            fillColor: color,
            fillOpacity: 0.8,
            weight: 1,
            radius: Math.max(4, 3 + (mag ?? 0) * 1.5),
        }
    }
    layerObj._quakesFetched = feats
    return geojson
}

function format(date) {
    return iso(date)
}

function derive(layerObj) {
    const feats = layerObj._quakesFetched
    if (!feats || feats.length === 0) return false

    // Only include buckets that actually have data in the fetched window.
    const present = new Set()
    for (const f of feats) {
        const m = f.properties?.mag ?? 0
        for (const b of MAG_BUCKETS)
            if (m >= b.min) {
                present.add(b.label)
                break
            }
    }

    layerObj._legend = MAG_BUCKETS.filter((b) => present.has(b.label)).map(
        (b) => ({
            color: b.color,
            shape: 'circle',
            value: b.label,
        })
    )
    return true
}

const Quakes = {
    source: { fetch },
    time: { format },
    legend: { derive },
}

export default Quakes
