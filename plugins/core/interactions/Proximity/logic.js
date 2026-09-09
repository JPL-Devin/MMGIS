/**
 * Proximity's decisions, with nothing imported from `src/essence`.
 * The handler feeds it plain GeoJSON and a distance function; it ranks.
 */

export const DEFAULTS = {
    radius: 500,
    maxResults: 25,
    layers: [],
    nameProp: 'name',
}

/** Merge admin config over runtime defaults, tolerating strings from forms. */
export function resolveConfig(config) {
    const c = config || {}
    const radius = parseFloat(c.radius)
    const maxResults = parseInt(c.maxResults)
    let layers = c.layers
    if (typeof layers === 'string')
        layers = layers
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
    return {
        radius: radius > 0 ? radius : DEFAULTS.radius,
        maxResults: maxResults > 0 ? maxResults : DEFAULTS.maxResults,
        layers: Array.isArray(layers) ? layers : DEFAULTS.layers,
        nameProp: c.nameProp || DEFAULTS.nameProp,
    }
}

/** Average of all coordinates: cheap centroid for any geometry type. */
export function centroid(geometry) {
    if (geometry == null || geometry.coordinates == null) return null
    let sumLng = 0
    let sumLat = 0
    let n = 0
    const walk = (c) => {
        if (typeof c[0] === 'number') {
            sumLng += c[0]
            sumLat += c[1]
            n++
        } else c.forEach(walk)
    }
    walk(geometry.coordinates)
    return n === 0 ? null : [sumLng / n, sumLat / n]
}

export function featureName(feature, nameProp) {
    const p = (feature && feature.properties) || {}
    const v = p[nameProp] ?? p.name ?? p.title ?? p.id
    return v == null ? '(unnamed)' : String(v)
}

/**
 * @param {object|null} feature   The clicked feature (excluded from results).
 * @param {Array<{layerName:string, feature:object}>} candidates
 * @param {object|null} config
 * @param {(lng1,lat1,lng2,lat2)=>number} distFn  meters between two lnglats
 * @returns {{center:number[], radius:number, results:Array}|null}
 */
export function decide(feature, candidates, config, distFn) {
    if (feature == null) return null
    const center = centroid(feature.geometry)
    if (center == null) return null
    const cfg = resolveConfig(config)

    const results = []
    for (const { layerName, feature: f } of candidates || []) {
        if (f === feature) continue
        if (cfg.layers.length > 0 && !cfg.layers.includes(layerName)) continue
        const c = centroid(f && f.geometry)
        if (c == null) continue
        const distance = distFn(center[0], center[1], c[0], c[1])
        if (distance > cfg.radius) continue
        results.push({
            layerName,
            feature: f,
            name: featureName(f, cfg.nameProp),
            distance,
            center: c,
        })
    }
    results.sort((a, b) => a.distance - b.distance)
    return {
        center,
        radius: cfg.radius,
        results: results.slice(0, cfg.maxResults),
    }
}
