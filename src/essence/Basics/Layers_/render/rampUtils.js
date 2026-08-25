import {
    data as colormapData,
    evaluate_cmap,
} from '@external/js-colormaps/js-colormaps.js'

export const RUNTIME_RAMPS = [
    'viridis',
    'plasma',
    'inferno',
    'magma',
    'cividis',
    'turbo',
    'Blues',
    'Greens',
    'Oranges',
    'Reds',
    'Purples',
    'YlGnBu',
    'YlOrRd',
    'RdYlGn',
    'RdYlBu',
    'RdBu',
    'BrBG',
    'PiYG',
    'coolwarm',
    'Spectral',
    'Greys',
]

export function resolveJsColormap(value, fallback = 'viridis', data = colormapData) {
    let name = typeof value === 'string' && value ? value : fallback
    const reverse = name.toLowerCase().endsWith('_r')
    if (reverse) name = name.slice(0, -2)
    const key = Object.keys(data || {}).find(
        (candidate) => candidate.toLowerCase() === name.toLowerCase()
    )
    return { colormap: key || name, reverse }
}

export function rampNamesFor(current, ramps = RUNTIME_RAMPS) {
    if (typeof current !== 'string' || current === '') return [...ramps]
    const exists = ramps.some(
        (name) => name.toLowerCase() === current.toLowerCase()
    )
    return exists ? [...ramps] : [current, ...ramps]
}

export function buildColormapRamps(
    current,
    fallback = 'viridis',
    customColors = null
) {
    const names = rampNamesFor(current, RUNTIME_RAMPS)
    const ramps = names
        .map((name) => {
            const { colormap, reverse } = resolveJsColormap(name, fallback)
            if (!colormapData?.[colormap]) return null
            const colors = Array.from({ length: 16 }, (_, index) => {
                const [r, g, b] = evaluate_cmap(
                    index / 15,
                    colormap,
                    reverse
                )
                return [r / 255, g / 255, b / 255]
            })
            return { name, label: name, colors }
        })
        .filter(Boolean)
    return customColors == null
        ? ramps
        : [{ name: 'custom', label: 'Custom', colors: customColors }, ...ramps]
}
