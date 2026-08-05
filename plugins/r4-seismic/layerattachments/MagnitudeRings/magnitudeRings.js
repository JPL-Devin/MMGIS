/**
 * MagnitudeRings — a ring per host feature, scaled by `properties.magnitude` and
 * coloured by `properties.depth_km`. Built for a `seismic` host, but it works on
 * any vector layer whose features carry those properties.
 *
 * Leaflet is read per call (never at import time) so the module is importable in
 * a Node unit test.
 */
import { ringRadiusMeters, depthColor } from './lib/rings'

const leaflet = () => window.L

const num = (v, fallback) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback)

const settings = (config) => ({
    scale: num(config?.scaleMeters, 2000),
    magnitudeProp: config?.magnitudeProp || 'magnitude',
    depthProp: config?.depthProp || 'depth_km',
    weight: num(config?.weight, 2),
})

/**
 * @returns {Array} One `L.circle` per point feature, each tagged with the
 *   feature's id so the interaction can find the ring of the event it summarised.
 */
function ringsOf(geojson, opts) {
    return (geojson?.features || [])
        .filter((f) => f?.geometry?.type === 'Point')
        .map((f) => {
            const [lng, lat] = f.geometry.coordinates
            const color = depthColor(f.properties?.[opts.depthProp])
            const ring = leaflet().circle([lat, lng], {
                radius: ringRadiusMeters(f.properties?.[opts.magnitudeProp], opts.scale),
                color,
                weight: opts.weight,
                fill: false,
            })
            // Read by the seismic:summary interaction to highlight rings.
            ring._seismicFeatureId = f.properties?.id ?? f.id ?? null
            ring._seismicBaseStyle = { color, weight: opts.weight }
            return ring
        })
}

function make(ctx) {
    const opts = settings(ctx.config)
    return {
        on: ctx.config?.initialVisibility !== false,
        type: 'magnitude_rings',
        geojson: ctx.geojson,
        layer: leaflet().layerGroup(ringsOf(ctx.geojson, opts)),
        // syncData is handed new data but not the config, so keep it here.
        _opts: opts,
    }
}

/**
 * The host's data changed. The core default re-adds the host's GeoJSON, which is
 * wrong for derived circles in a layerGroup — they are rebuilt instead. A
 * seismic host refetches on every view change, so this is the hot path.
 */
function syncData(attachment, { geojson, onlyClear }) {
    attachment.layer.clearLayers()
    attachment.geojson = geojson
    if (onlyClear) return
    ringsOf(geojson, attachment._opts).forEach((r) => attachment.layer.addLayer(r))
}

/** Retune in place instead of paying for core's default host rebuild. */
function onConfigChange(ctx) {
    const attachment = ctx.attachment
    if (!attachment) return
    attachment._opts = settings(ctx.config)
    syncData(attachment, { geojson: attachment.geojson })
}

export default { make, syncData, onConfigChange }
