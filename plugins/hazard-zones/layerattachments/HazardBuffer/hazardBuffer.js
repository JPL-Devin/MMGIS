/**
 * HazardBuffer attachment — the exclusion band around every hazard zone.
 *
 * It is also the container's shared state: the buffered features it derives are
 * kept on the attachment object core stores at
 * `L_.layers.attachments[hostName].hazard_buffer`, which is where the
 * hazard:report interaction reads them from rather than re-deriving them.
 */
import { bufferPolygonFeature, colorForSeverity } from '../../lib/hazardGeometry'

// Read Leaflet's global per call, not at import time, so this module can be
// imported by a unit test outside the browser.
const leaflet = () => window.L

const num = (v, fallback) =>
    Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback

/** The buffered twin of every polygon in the host's data. */
function bufferedFeatures(geojson, meters) {
    return (geojson?.features || [])
        .map((f) => bufferPolygonFeature(f, meters))
        .filter(Boolean)
}

function bandLayer(features, config) {
    const dashArray = config?.dashArray || '6 6'
    return leaflet().geoJson(
        { type: 'FeatureCollection', features },
        {
            style: (f) => ({
                color: config?.color || colorForSeverity(f?.properties?.severity),
                weight: 2,
                dashArray,
                fill: true,
                fillOpacity: 0.08,
            }),
            interactive: false,
        }
    )
}

function make(ctx) {
    const meters = num(ctx.config?.bufferMeters, 250)
    const features = bufferedFeatures(ctx.geojson, meters)
    const geojson = { type: 'FeatureCollection', features }

    return {
        on: ctx.config?.initialVisibility !== false,
        type: 'hazard_buffer',
        geojson,
        layer: bandLayer(features, ctx.config),
        // Read by the hazard:report interaction — the buffered geometry is
        // derived once here rather than in both plugins.
        _bufferMeters: meters,
        _bufferedFeatures: features,
        _config: ctx.config || {},
    }
}

/**
 * The host's data changed. Core's default re-adds the *host's* GeoJSON, which
 * would draw the unbuffered zones, so the band is rebuilt from the new data.
 */
function syncData(attachment, { geojson, onlyClear }) {
    attachment.layer.clearLayers()
    attachment._bufferedFeatures = []
    if (onlyClear) return
    const features = bufferedFeatures(geojson, attachment._bufferMeters)
    attachment._bufferedFeatures = features
    attachment.geojson = { type: 'FeatureCollection', features }
    attachment.layer.addData(attachment.geojson)
}

/**
 * Retune in place instead of paying for core's default host rebuild. Also keeps
 * `_bufferedFeatures` current for the interaction reading it.
 */
function onConfigChange(ctx) {
    const attachment = ctx.attachment
    if (!attachment) return
    const meters = num(ctx.config?.bufferMeters, 250)
    attachment._bufferMeters = meters
    attachment._config = ctx.config || {}
    syncData(attachment, {
        geojson: ctx.layerObj?._geojson || ctx.geojson,
        onlyClear: false,
    })
}

export default {
    make,
    syncData,
    onConfigChange,
}
