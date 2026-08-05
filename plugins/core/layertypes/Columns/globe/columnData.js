/**
 * Columns layer type — engine-neutral column specs.
 *
 * Turns the GeoJSON the map layer is already holding into a flat list of
 * extruded-column specs, so each engine module only has to place geometry.
 * Shared by the globe engine modules; core never builds this.
 */
import L_ from '@basics/Layers_/Layers_'

const DEFAULTS = {
    heightScale: 1,
    minHeight: 0,
    maxHeight: 100000,
    radius: 200,
    baseElevation: 0,
    lowColor: '#2c7bb6',
    highColor: '#d7191c',
}

function settings(layerObj) {
    return { ...DEFAULTS, ...(layerObj.variables?.columns || {}) }
}

function num(v) {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : null
}

function hexToRgb(hex) {
    const h = String(hex).replace('#', '')
    const f =
        h.length === 3
            ? h
                  .split('')
                  .map((c) => c + c)
                  .join('')
            : h
    return [
        parseInt(f.slice(0, 2), 16),
        parseInt(f.slice(2, 4), 16),
        parseInt(f.slice(4, 6), 16),
    ]
}

function rgbToHex([r, g, b]) {
    const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
    return `#${c(r)}${c(g)}${c(b)}`
}

/** Linear ramp between two colors; `t` is clamped to [0, 1]. */
export function ramp(lowColor, highColor, t) {
    const a = hexToRgb(lowColor)
    const b = hexToRgb(highColor)
    const f = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0))
    return rgbToHex(a.map((v, i) => v + (b[i] - v) * f))
}

/**
 * @returns {{ columns: Array, range: [number, number]|null, settings: Object }}
 *          `columns` is empty when the layer has no point features yet.
 */
export function columnSpecs(layerObj) {
    const s = settings(layerObj)
    const mapLayer = L_.layers.layer[layerObj.name]
    const geojson =
        mapLayer && typeof mapLayer.toGeoJSON === 'function'
            ? mapLayer.toGeoJSON(L_.GEOJSON_PRECISION)
            : null
    const features = geojson?.features || []

    const points = []
    for (const feature of features) {
        const geom = feature?.geometry
        if (!geom) continue
        const coords =
            geom.type === 'Point'
                ? [geom.coordinates]
                : geom.type === 'MultiPoint'
                ? geom.coordinates
                : []
        const value = s.heightProp ? num(feature.properties?.[s.heightProp]) : null
        for (const c of coords)
            points.push({
                feature,
                lng: num(c[0]),
                lat: num(c[1]),
                z: num(c[2]) ?? 0,
                value,
            })
    }

    const values = points.map((p) => p.value).filter((v) => v != null)
    const range = values.length
        ? [Math.min(...values), Math.max(...values)]
        : null
    const span = range ? range[1] - range[0] : 0

    const columns = points
        .filter((p) => p.lng != null && p.lat != null)
        .map((p) => {
            const t = range && span > 0 ? (p.value - range[0]) / span : 0
            const raw = (p.value ?? 1) * s.heightScale
            return {
                feature: p.feature,
                lng: p.lng,
                lat: p.lat,
                base: s.baseElevation + p.z,
                height: Math.max(
                    s.minHeight,
                    Math.min(s.maxHeight, Number.isFinite(raw) ? raw : s.minHeight)
                ),
                radius: num(s.radius) ?? DEFAULTS.radius,
                color: s.colorProp
                    ? featureColor(p.feature, s)
                    : ramp(s.lowColor, s.highColor, t),
                value: p.value,
                t,
            }
        })

    return { columns, range, settings: s }
}

function featureColor(feature, s) {
    const v = feature?.properties?.[s.colorProp]
    if (typeof v === 'string' && v.startsWith('#')) return v
    return ramp(s.lowColor, s.highColor, 0.5)
}

export default { columnSpecs, ramp }
