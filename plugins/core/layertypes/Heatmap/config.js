// `config.normalize` — heatmap defaults applied during mission config parsing.
export const HEATMAP_DEFAULTS = Object.freeze({
    radius: 25,
    blur: 15,
    radiusUnits: 'px',
    lineSampleSpacingMeters: 10,
    polygonInteriorSamples: 64,
    gradient: { 0.4: 'blue', 0.65: 'lime', 1: 'red' },
})

export function parseGradient(gradient) {
    if (gradient == null || gradient === '')
        return { ...HEATMAP_DEFAULTS.gradient }
    let g = gradient
    if (typeof g === 'string') {
        try {
            g = JSON.parse(g)
        } catch (e) {
            return { ...HEATMAP_DEFAULTS.gradient }
        }
    }
    if (
        typeof g !== 'object' ||
        Array.isArray(g) ||
        Object.keys(g).length === 0
    )
        return { ...HEATMAP_DEFAULTS.gradient }
    return g
}

function numOr(v, fallback) {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : fallback
}

// Resolved, typed heatmap options for a layer object.
export function heatmapOptions(layerObj) {
    const v = layerObj.variables || {}
    return {
        sourceLayer: v.sourceLayer,
        weightProperty: v.weightProperty || null,
        weightMin:
            v.weightMin === '' ? undefined : numOr(v.weightMin, undefined),
        weightMax:
            v.weightMax === '' ? undefined : numOr(v.weightMax, undefined),
        radius: numOr(v.radius, HEATMAP_DEFAULTS.radius),
        blur: numOr(v.blur, HEATMAP_DEFAULTS.blur),
        maxIntensity:
            v.maxIntensity === ''
                ? undefined
                : numOr(v.maxIntensity, undefined),
        radiusUnits: v.radiusUnits === 'm' ? 'm' : 'px',
        lineSampleSpacingMeters: numOr(
            v.lineSampleSpacingMeters,
            HEATMAP_DEFAULTS.lineSampleSpacingMeters
        ),
        polygonInteriorSamples: numOr(
            v.polygonInteriorSamples,
            HEATMAP_DEFAULTS.polygonInteriorSamples
        ),
        gradient: parseGradient(v.gradient),
    }
}

function normalize(layerObj) {
    layerObj.variables = layerObj.variables || {}
    layerObj.url = layerObj.url || ''
    layerObj.kind = layerObj.kind || 'none'
    layerObj.variables.radiusUnits =
        layerObj.variables.radiusUnits === 'm' ? 'm' : 'px'
    return layerObj
}

export default {
    normalize,
}
