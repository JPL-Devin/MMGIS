/**
 * Curtain layer type — the legend is the render.
 *
 * A radargram's image carries no key, so the useful legend is the geometry it was
 * hung with: the depth range the image spans and which way is down. Configured
 * legends win; this only runs when the layer has none.
 */
import { curtainConfig } from './globe/curtain'

function derive(layerObj) {
    const { top, bottom, depthLabel } = curtainConfig(layerObj)
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || top === bottom)
        return false

    layerObj._legend = [
        { color: 'transparent', strokecolor: '#888', shape: 'rect', value: depthLabel },
        { color: '#dddddd', shape: 'rect', value: `${fmt(top)} (top of curtain)` },
        { color: '#888888', shape: 'rect', value: `${fmt((top + bottom) / 2)}` },
        { color: '#333333', shape: 'rect', value: `${fmt(bottom)} (bottom)` },
    ]
    return true
}

function fmt(meters) {
    return Math.abs(meters) >= 1000
        ? `${(meters / 1000).toFixed(1)} km`
        : `${Math.round(meters)} m`
}

export default { derive }
