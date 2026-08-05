/**
 * FovFootprint — the ground footprint of each pointed observation.
 *
 * An ordinary Leaflet layer built from the host's own GeoJSON, so `make` plus a
 * `syncData` (the derived polygons must be re-derived, not re-added) is the
 * whole plugin.
 *
 * Leaflet is read off `window` per call rather than imported, so the module can
 * be imported in a Node unit test; the geometry lives in ../../lib/fov.js for
 * the same reason.
 */
import { footprintCollection } from '../../lib/fov'

const leaflet = () => window.L

const styleOf = (config) => ({
    color: config?.color || '#c67f00',
    weight: 1,
    opacity: 0.9,
    fillColor: config?.color || '#c67f00',
    fillOpacity: 0.15,
})

function layerFor(geojson, config) {
    return leaflet().geoJson(footprintCollection(geojson, config || {}), {
        style: () => styleOf(config),
        // A footprint is scenery: clicks belong to the observation beneath it,
        // so the pipeline the layer's type configured still runs.
        interactive: false,
    })
}

function make({ geojson, config }) {
    return {
        on: config?.initialVisibility !== false,
        type: 'fov_footprint',
        geojson,
        layer: layerFor(geojson, config),
    }
}

/** Derived polygons — core's default re-adds the host's raw GeoJSON instead. */
function syncData(attachment, { geojson, onlyClear, config }) {
    attachment.layer.clearLayers()
    if (onlyClear) return
    attachment.layer.addData(footprintCollection(geojson, config || {}))
    attachment.layer.setStyle(styleOf(config))
    attachment.geojson = geojson
}

/** Retune in place instead of paying for core's default host rebuild. */
function onConfigChange(ctx) {
    if (!ctx.attachment) return
    syncData(ctx.attachment, {
        geojson: ctx.attachment.geojson,
        config: ctx.config,
    })
}

const FovFootprint = { make, syncData, onConfigChange }

export default FovFootprint
