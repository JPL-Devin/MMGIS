/**
 * VisibilityFootprint — a circle around each surface asset showing where an
 * orbiter must be for the asset to see it above its elevation mask.
 *
 * The radius depends on the *orbiter's* altitude, which is a fact of the
 * GroundTrack layer, not of this attachment's host. There is no documented way
 * for a layer type to hand settings to an attachment on a *different* layer
 * (`capabilities.defaultAttachments` only reaches attachments of its own
 * layers), so the host names the track layer and this module reads that layer's
 * config off `L_` — see the container README.
 */
import { footprintRadiusMeters } from '../../shared/comms'

const leaflet = () => window.L
const num = (v, d) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : d)

/**
 * The orbit altitude the footprint is sized from: the track layer's own
 * configured value when the host names one, else this attachment's setting.
 * Reading a *peer* layer's config is the seam this plugin could not avoid.
 */
export function resolveAltitudeMeters(config, layersData) {
    const named = config?.trackLayerName
    const peer = named && layersData ? layersData[named] : null
    return num(
        peer?.variables?.altitudeMeters ?? config?.altitudeMeters,
        400000
    )
}

export function footprintsOf(geojson, radius, style) {
    return (geojson?.features || [])
        .filter((f) => f.geometry?.type === 'Point')
        .map((f) => {
            const [lng, lat] = f.geometry.coordinates
            return leaflet().circle([lat, lng], { radius, ...style })
        })
}

function make(ctx) {
    const config = ctx.config || {}
    const elevationMaskDeg = num(config.elevationMaskDeg, 10)
    const bodyRadiusMeters = num(config.bodyRadiusMeters, 3396190)
    const altitudeMeters = resolveAltitudeMeters(
        config,
        window.L_?.layers?.data
    )
    const radius = footprintRadiusMeters(
        altitudeMeters,
        elevationMaskDeg,
        bodyRadiusMeters
    )
    const style = {
        color: config.color || '#38bdf8',
        weight: num(config.weight, 1),
        fill: config.fill !== false,
        fillOpacity: num(config.fillOpacity, 0.08),
    }

    return {
        on: config.initialVisibility !== false,
        type: 'visibility_footprint',
        geojson: ctx.geojson,
        layer: leaflet().layerGroup(footprintsOf(ctx.geojson, radius, style)),
        // Kept for syncData, which is handed new data but re-derives nothing.
        _radius: radius,
        _style: style,
    }
}

/** Derived circles in a layerGroup, so core's re-addData default is wrong. */
function syncData(attachment, { geojson, onlyClear }) {
    attachment.layer.clearLayers()
    if (onlyClear) return
    footprintsOf(geojson, attachment._radius, attachment._style).forEach((c) =>
        attachment.layer.addLayer(c)
    )
}

const VisibilityFootprint = {
    make,
    syncData,
}

export default VisibilityFootprint
