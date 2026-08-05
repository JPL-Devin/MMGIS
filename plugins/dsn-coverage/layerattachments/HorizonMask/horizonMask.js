/**
 * HorizonMask attachment — the horizon-mask ring of each ground station, sized
 * from that station's own antenna diameter and mask elevation plus a
 * settings-level scale.
 *
 * The property names it reads are not its own knowledge: the GroundStation type
 * declares them (and the scale) in `capabilities.defaultAttachments.horizon_mask`,
 * and core hands them over as `ctx.config`, so this plugin never reads the host's
 * config or the other plugin's subtree.
 */
import {
    circleRing,
    maskRadiusMeters,
    num,
    stationOf,
} from '../../lib/coverage'

// Read the Leaflet global per call, not at import time, so the module stays
// importable in a Node unit test.
const leaflet = () => window.L

const stationsOf = (geojson) =>
    (geojson?.features || []).filter((f) => f.geometry?.type === 'Point')

const ringStyle = (config) => ({
    color: config?.color || '#4dd0e1',
    weight: num(config?.weight, 1.5),
    fill: true,
    fillColor: config?.color || '#4dd0e1',
    fillOpacity: num(config?.fillOpacity, 0.12),
    className: 'noPointerEventsImportant',
})

/** One Leaflet circle per station, radius from the station's own properties. */
const maskLayers = (geojson, config) =>
    stationsOf(geojson).map((f) => {
        const station = stationOf(f, config)
        const radius = maskRadiusMeters(station, config)
        return leaflet().circle([station.lat, station.lng], {
            radius,
            ...ringStyle(config),
        })
    })

/** The same rings as polygons, for the globe's clamped surface. */
const maskGeoJSON = (geojson, config) => ({
    type: 'FeatureCollection',
    features: stationsOf(geojson).map((f) => {
        const station = stationOf(f, config)
        return {
            type: 'Feature',
            properties: { ...f.properties },
            geometry: {
                type: 'Polygon',
                coordinates: [
                    circleRing(station, maskRadiusMeters(station, config)),
                ],
            },
        }
    }),
})

function make(ctx) {
    const { geojson, config, layerObj } = ctx
    const clampedOptions = {
        name: `horizonMask_${layerObj.name}Clamped`,
        on: config?.initialVisibility !== false,
        order: -9999,
        opacity: num(config?.opacity3d, 0.5),
        minZoom: layerObj.minZoom != null ? layerObj.minZoom : 0,
        maxZoom: layerObj.maxZoom != null ? layerObj.maxZoom : 100,
        geojson: maskGeoJSON(geojson, config),
        style: { default: ringStyle(config) },
    }

    return {
        on: config?.initialVisibility !== false,
        type: 'horizon_mask',
        geojson,
        layer: leaflet().layerGroup(maskLayers(geojson, config)),
        clampedLayerId: clampedOptions.name,
        clampedOptions,
        // syncData is handed new data but not the config, so keep it.
        _config: config,
    }
}

/**
 * Core's default re-adds the host's GeoJSON to the attachment's layer, which is
 * right for an `L.geoJson` attachment; these are derived circles in a
 * layerGroup, so they are rebuilt — and the globe surface is ours to replace.
 */
function syncData(attachment, { geojson, onlyClear }) {
    attachment.layer.clearLayers()
    const litho = window.L_?.Globe_?.litho
    if (litho) litho.removeLayer(attachment.clampedLayerId)
    if (onlyClear) return
    maskLayers(geojson, attachment._config).forEach((ring) =>
        attachment.layer.addLayer(ring)
    )
    attachment.clampedOptions.geojson = maskGeoJSON(
        geojson,
        attachment._config
    )
}

/**
 * The 2D overlay is core's to add and remove; the clamped globe surface is ours,
 * so one visibility change means two engines.
 */
function setVisibility(attachment, ctx = {}) {
    const L_ = window.L_
    const litho = L_?.Globe_?.litho
    if (ctx.visible) {
        if (litho) litho.addLayer('clamped', attachment.clampedOptions)
        if (!ctx.globeOnly) L_?.Map_?.map?.addLayer(attachment.layer)
        ctx.applyOrder?.()
        ctx.applyOpacity?.()
    } else {
        if (litho) litho.removeLayer(attachment.clampedLayerId)
        if (!ctx.globeOnly) L_?.Map_?.rmNotNull(attachment.layer)
    }
}

/** Retune in place rather than paying for core's rebuild of the whole host. */
function onConfigChange(ctx) {
    const attachment = ctx.attachment
    if (!attachment) return
    attachment._config = ctx.config
    syncData(attachment, { geojson: attachment.geojson })
}

const HorizonMask = { make, syncData, setVisibility, onConfigChange }

export default HorizonMask
