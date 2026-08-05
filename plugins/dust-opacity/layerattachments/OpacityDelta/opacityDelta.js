/**
 * OpacityDelta attachment — visualises the difference between the predicted and
 * observed dust opacity its host layer joined.
 *
 * It reads only its host's own features (`ctx.geojson`), which already carry
 * both values because the host's `source.fetch` joined them — so this stays
 * inside the supported "one layer" shape rather than reading a second layer.
 */
import { deltaRange } from '../../lib/dustJoin'

// Leaflet is a global the app sets up before any attachment is built. Read it
// per call rather than at import time, so this module can be imported (and unit
// tested) outside the browser.
const leaflet = () => window.L

const num = (v, fallback) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback)

/** A diverging blue→white→red ramp over a symmetric delta range. */
export function deltaColor(delta, max) {
    if (delta === null || delta === undefined || !Number.isFinite(delta)) return '#888888'
    if (!max) return '#f7f7f7'
    const t = Math.max(-1, Math.min(1, delta / max))
    const mix = (a, b, f) => Math.round(a + (b - a) * f)
    const [r, g, b] =
        t >= 0
            ? [mix(247, 178, t), mix(247, 24, t), mix(247, 43, t)]
            : [mix(247, 33, -t), mix(247, 102, -t), mix(247, 172, -t)]
    return `rgb(${r},${g},${b})`
}

function circlesOf(geojson, config) {
    const deltaProp = config?.deltaProp || 'dust_delta'
    const scale = num(config?.scale, 12)
    const [, max] = deltaRange(geojson)

    return (geojson?.features || [])
        .filter((f) => f.geometry?.type === 'Point')
        .map((f) => {
            const delta = num(f.properties?.[deltaProp], null)
            const [lng, lat] = f.geometry.coordinates
            const radius =
                delta === null ? 3 : 3 + (Math.abs(delta) / (max || 1)) * scale
            return leaflet().circleMarker([lat, lng], {
                radius,
                color: '#222',
                weight: 1,
                fillColor: deltaColor(delta, max),
                fillOpacity: 0.85,
            })
        })
}

function make(ctx) {
    const layer = leaflet().layerGroup(circlesOf(ctx.geojson, ctx.config))
    return {
        on: ctx.config?.initialVisibility !== false,
        type: 'opacity_delta',
        geojson: ctx.geojson,
        layer,
    }
}

/**
 * The host's data changed. The core default re-adds the host's GeoJSON to the
 * attachment's layer, which is wrong for derived circleMarkers in a layerGroup.
 */
function syncData(attachment, { geojson, onlyClear, config }) {
    attachment.layer.clearLayers()
    if (onlyClear) return
    attachment.geojson = geojson
    circlesOf(geojson, config).forEach((c) => attachment.layer.addLayer(c))
}

/**
 * Settings changed. Retune in place instead of paying for core's default, which
 * rebuilds the whole host layer.
 */
function onConfigChange(ctx) {
    if (!ctx.attachment) return
    syncData(ctx.attachment, {
        geojson: ctx.attachment.geojson,
        config: ctx.config,
    })
}

const OpacityDelta = {
    make,
    syncData,
    onConfigChange,
}

export default OpacityDelta
