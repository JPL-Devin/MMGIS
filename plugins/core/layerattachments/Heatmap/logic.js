/**
 * Heatmap logic — the parts that are pure and testable in Node, so nothing here
 * imports an MMGIS singleton.
 */

const DEFAULT_GRADIENT = ['#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000']

// The host's settings with every omission defaulted.
export const settings = (config = {}) => ({
    radius: config.radius > 0 ? config.radius : 25,
    blur: config.blur >= 0 ? config.blur : 15,
    opacity: config.opacity != null ? config.opacity : 0.8,
    gradient:
        Array.isArray(config.gradient) && config.gradient.length > 1
            ? config.gradient
            : DEFAULT_GRADIENT,
    weightProp: config.weightProp || null,
    minIntensity: config.minIntensity,
    maxIntensity: config.maxIntensity,
})

const dottedLookup = (properties, prop) =>
    String(prop)
        .split('.')
        .reduce((o, k) => (o == null ? undefined : o[k]), properties)

/**
 * [lat, lng, weight] per point feature. Multipoints contribute one per
 * coordinate; anything else has no density to draw. `readProp` is F_.getIn at
 * runtime and a plain dotted lookup in tests.
 */
export const pointsOf = (geojson, options, readProp = dottedLookup) => {
    const points = []
    const push = (coords, weight) => {
        if (!Array.isArray(coords) || coords.length < 2) return
        points.push([coords[1], coords[0], weight])
    }
    ;(geojson?.features || []).forEach((f) => {
        if (!f?.geometry) return
        let weight = 1
        if (options.weightProp) {
            weight = parseFloat(readProp(f.properties, options.weightProp))
            if (!isFinite(weight)) weight = 0
        }
        if (f.geometry.type === 'Point') push(f.geometry.coordinates, weight)
        else if (f.geometry.type === 'MultiPoint')
            f.geometry.coordinates.forEach((c) => push(c, weight))
    })
    return points
}

// The weight range the gradient spans, the layer's own unless configured.
export const intensityRange = (points, options) => {
    let min = options.minIntensity
    let max = options.maxIntensity
    if (min == null || max == null) {
        const weights = points.map((p) => p[2])
        if (min == null) min = weights.length ? Math.min(...weights) : 0
        if (max == null) max = weights.length ? Math.max(...weights) : 1
    }
    return { min, max, span: max - min || 1 }
}

// A weight as its 0-1 place in the range, never fully transparent.
export const normalize = (weight, range) =>
    Math.min(1, Math.max(0.05, (weight - range.min) / range.span || 0.05))
