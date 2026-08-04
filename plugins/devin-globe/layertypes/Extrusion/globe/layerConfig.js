/**
 * Extrusion layer type — globe layer config and the pure math behind it.
 *
 * The type is globe-only, so (like 3D Tiles) the config is built from the
 * layer's own MMGIS config object rather than from a 2D map layer. The scaling
 * and ramp helpers are kept pure so they can be unit tested without a globe.
 */
import L_ from '@basics/Layers_/Layers_'

export const DEFAULT_RAMP = ['#2c7bb6', '#abd9e9', '#ffffbf', '#fdae61', '#d7191c']

export function toGlobeConfig(layerObj) {
    const s = layerObj
    const v = s.variables || {}
    const e = v.extrusion || {}

    return {
        name: s.name,
        path: L_.getUrl(s.type, s.url, s),
        opacity: L_.layers.opacity[s.name] ?? 1,
        property: e.property || s.extrusionProperty || null,
        heightScale: num(e.heightScale ?? s.heightScale, 1),
        baseHeight: num(e.baseHeight ?? s.baseHeight, 0),
        maxHeight: num(e.maxHeight ?? s.maxHeight, 0),
        columnRadius: num(e.columnRadius ?? s.columnRadius, 500),
        ramp: Array.isArray(e.ramp) && e.ramp.length ? e.ramp : DEFAULT_RAMP,
        min: e.min != null ? num(e.min, 0) : null,
        max: e.max != null ? num(e.max, 0) : null,
        outline: e.outline !== false,
    }
}

function num(value, fallback) {
    const n = parseFloat(value)
    return Number.isFinite(n) ? n : fallback
}

/** Numeric domain of `property` across the features, ignoring non-numbers. */
export function propertyDomain(geojson, property) {
    let min = Infinity
    let max = -Infinity
    const features = geojson?.features || []
    for (const f of features) {
        const value = parseFloat(f?.properties?.[property])
        if (!Number.isFinite(value)) continue
        if (value < min) min = value
        if (value > max) max = value
    }
    if (min === Infinity) return null
    return { min, max }
}

/** 0..1 position of `value` within the domain (clamped; 0 for a flat domain). */
export function normalize(value, domain) {
    if (!domain) return 0
    const { min, max } = domain
    if (!(max > min)) return 0
    return Math.min(1, Math.max(0, (value - min) / (max - min)))
}

/**
 * Meters to extrude a feature. `maxHeight` (when > 0) makes the tallest feature
 * exactly that tall regardless of the data's units; otherwise the raw value is
 * multiplied by `heightScale`.
 */
export function extrudedHeight(value, domain, config) {
    if (!Number.isFinite(value)) return config.baseHeight
    const height =
        config.maxHeight > 0
            ? normalize(value, domain) * config.maxHeight
            : value * config.heightScale
    return config.baseHeight + height
}

/** Interpolated hex color from the ramp at 0..1 `t`. */
export function rampColor(t, ramp = DEFAULT_RAMP) {
    if (ramp.length === 1) return ramp[0]
    const clamped = Math.min(1, Math.max(0, t))
    const scaled = clamped * (ramp.length - 1)
    const i = Math.min(ramp.length - 2, Math.floor(scaled))
    return mixHex(ramp[i], ramp[i + 1], scaled - i)
}

function mixHex(a, b, t) {
    const ca = hexToRgb(a)
    const cb = hexToRgb(b)
    if (!ca || !cb) return a
    const to = (x) => Math.round(x).toString(16).padStart(2, '0')
    return `#${to(ca[0] + (cb[0] - ca[0]) * t)}${to(
        ca[1] + (cb[1] - ca[1]) * t
    )}${to(ca[2] + (cb[2] - ca[2]) * t)}`
}

function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim())
    if (!m) return null
    const n = parseInt(m[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
