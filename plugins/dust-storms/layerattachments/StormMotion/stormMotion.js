/**
 * StormMotion attachment — an arrow per storm observation, along its heading,
 * scaled by speed × intensity.
 *
 * Which property holds the speed, the heading and the intensity is a fact the
 * *layer type* knows; it reaches here as `ctx.config` because
 * DustStormFronts declares this attachment in `capabilities.defaultAttachments`
 * with those settings. This module never reads the host's config itself.
 */
import { motionVectorOf, num } from '../../lib/storms'

// Leaflet is a global the app sets up before any attachment is built. Read it
// per call rather than at import time, so this module can be imported (and unit
// tested) outside the browser.
const leaflet = () => window.L

const settingsOf = (config) => ({
    props: {
        speedProp: config?.speedProp,
        headingProp: config?.headingProp,
        intensityProp: config?.intensityProp,
    },
    scale: num(config?.scale, 1),
    color: config?.color || '#ffb000',
    weight: num(config?.weight, 2),
})

/** The polylines — shaft plus two barbs — for every feature that has a motion. */
export function arrowsOf(geojson, settings) {
    const L = leaflet()
    const out = []
    ;(geojson?.features || []).forEach((f) => {
        const v = motionVectorOf(f, settings.props, settings.scale)
        if (v == null) return
        const line = [
            [v.from[1], v.from[0]],
            [v.to[1], v.to[0]],
        ]
        const options = {
            color: settings.color,
            // Heavier storms draw a heavier arrow as well as a longer one.
            weight: settings.weight * Math.max(1, v.intensity),
        }
        out.push(L.polyline(line, options))
        out.push(L.polyline(barbsOf(v), options))
    })
    return out
}

/** The arrowhead, as a single 3-point polyline. */
function barbsOf(v) {
    const dLng = v.to[0] - v.from[0]
    const dLat = v.to[1] - v.from[1]
    const back = Math.atan2(-dLat, -dLng)
    const len = Math.sqrt(dLng * dLng + dLat * dLat) * 0.25
    const wing = (a) => [
        v.to[1] + Math.sin(a) * len,
        v.to[0] + Math.cos(a) * len,
    ]
    return [wing(back - 0.4), [v.to[1], v.to[0]], wing(back + 0.4)]
}

function make(ctx) {
    const settings = settingsOf(ctx.config)
    return {
        on: ctx.config?.initialVisibility !== false,
        type: 'storm_motion',
        geojson: ctx.geojson,
        layer: leaflet().layerGroup(arrowsOf(ctx.geojson, settings)),
        // syncData is handed new data but no config, so keep the settings.
        _settings: settings,
    }
}

/**
 * The host's data changed — on a time change, that is a different set of storms.
 * The core default re-adds GeoJSON, which is wrong for derived polylines.
 */
function syncData(attachment, { geojson, onlyClear }) {
    attachment.layer.clearLayers()
    if (onlyClear) return
    attachment.geojson = geojson
    arrowsOf(geojson, attachment._settings).forEach((l) =>
        attachment.layer.addLayer(l)
    )
}

/** Retune in place rather than paying for core's rebuild of the whole host. */
function onConfigChange(ctx) {
    if (ctx.attachment == null) return
    ctx.attachment._settings = settingsOf(ctx.config)
    syncData(ctx.attachment, { geojson: ctx.attachment.geojson })
}

const StormMotion = {
    make,
    syncData,
    onConfigChange,
}

export default StormMotion
