/**
 * WindBarbs attachment — a barb drawn from each of the host's point features,
 * pointing downwind and scaled by speed.
 *
 * The property names come from `ctx.config`, which for a `windfield` layer is
 * what the layer type declared in `capabilities.defaultAttachments.wind_barbs`.
 */
import { barbLine, speedCategory, CATEGORY_COLORS, num } from '../../lib/wind'

// Read Leaflet per call, not at import time, so this stays importable in Node.
const leaflet = () => window.L

export function barbsOf(geojson, config) {
    const speedProp = config?.speedProp || 'windSpeed'
    const directionProp = config?.directionProp || 'windDirection'
    const scale = num(config?.scale, 200)
    const weight = num(config?.weight, 2)

    return (geojson?.features || [])
        .filter((f) => f.geometry?.type === 'Point')
        .map((f) => {
            const [lng, lat] = f.geometry.coordinates
            const speed = num(f.properties?.[speedProp], 0)
            const direction = num(f.properties?.[directionProp], 0)
            return {
                lines: barbLine(lat, lng, speed, direction, scale),
                color: CATEGORY_COLORS[speedCategory(speed)],
                weight,
            }
        })
}

const toLayers = (barbs) =>
    barbs.flatMap((b) =>
        b.lines.map((line) =>
            leaflet().polyline(line, { color: b.color, weight: b.weight })
        )
    )

function make(ctx) {
    return {
        on: ctx.config?.initialVisibility !== false,
        type: 'wind_barbs',
        geojson: ctx.geojson,
        layer: leaflet().layerGroup(toLayers(barbsOf(ctx.geojson, ctx.config))),
        _config: ctx.config,
    }
}

/**
 * Derived polylines in a layerGroup, so the core default (re-adding the host's
 * GeoJSON to the attachment's layer) is wrong here — rebuild instead.
 */
function syncData(attachment, { geojson, onlyClear }) {
    attachment.layer.clearLayers()
    if (onlyClear) return
    attachment.geojson = geojson
    toLayers(barbsOf(geojson, attachment._config)).forEach((l) =>
        attachment.layer.addLayer(l)
    )
}

/** Retune in place rather than paying for a full host rebuild. */
function onConfigChange(ctx) {
    const attachment = ctx.attachment
    if (!attachment) return
    attachment._config = ctx.config
    syncData(attachment, { geojson: attachment.geojson })
}

const WindBarbs = { make, syncData, onConfigChange }

export default WindBarbs
