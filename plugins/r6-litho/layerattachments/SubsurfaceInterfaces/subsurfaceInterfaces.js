/**
 * SubsurfaceInterfaces — detected radar interfaces along a sounding track.
 *
 * Each host feature carries an array of detected interfaces (bedrock, internal
 * layering) as `[{ traceIndex, depth_m }, …]` under a property the *host's layer
 * type* names. The type declares that property name to this attachment in its
 * `capabilities.defaultAttachments`, so nothing here hardcodes a schema.
 *
 * On the 2D map the interfaces are drawn as markers on the track, coloured and
 * sized by depth. On the globe they belong at their depth inside the host's
 * curtain — see the report: the attachment contract has no globe operation to
 * express that in, so this declares `globe: false` rather than reaching for
 * `L_.Globe_.litho` the way core's PathGradient does.
 */

// Read the Leaflet global per call, not at import time, so the module can be
// imported outside the browser (`npm run test:plugins:unit` does exactly that).
const leaflet = () => window.L

const num = (v, fallback) =>
    Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback

/** #ffd -> #f00 by depth, so a deep interface reads darker/redder. */
export function depthColor(depth, maxDepth) {
    const t = Math.max(0, Math.min(1, num(depth, 0) / num(maxDepth, 1) || 0))
    const r = Math.round(255 - 60 * t)
    const g = Math.round(220 - 200 * t)
    const b = Math.round(120 - 110 * t)
    return `rgb(${r},${g},${b})`
}

/**
 * The interfaces of one host feature, as { lng, lat, depth } — the geometry's
 * own vertex for the trace the interface was detected in.
 */
export function interfacesOf(feature, opts) {
    const { interfacesProp, depthProp, traceProp } = opts
    const list = feature?.properties?.[interfacesProp]
    if (!Array.isArray(list)) return []

    const geometry = feature.geometry
    const coordinates =
        geometry?.type === 'LineString'
            ? geometry.coordinates
            : geometry?.type === 'MultiLineString'
              ? geometry.coordinates[0]
              : null
    if (coordinates == null) return []

    return list
        .map((entry) => {
            const i = Math.max(
                0,
                Math.min(coordinates.length - 1, num(entry?.[traceProp], 0))
            )
            const c = coordinates[Math.round(i)]
            if (c == null) return null
            return { lng: c[0], lat: c[1], depth: num(entry?.[depthProp], NaN) }
        })
        .filter((p) => p != null && Number.isFinite(p.depth))
}

function optionsOf(config) {
    return {
        interfacesProp: config?.interfacesProp || 'interfaces',
        depthProp: config?.depthProp || 'depth_m',
        traceProp: config?.traceProp || 'traceIndex',
        maxDepthMeters: num(config?.maxDepthMeters, 3000),
        radius: num(config?.radius, 4),
    }
}

function markersOf(geojson, opts) {
    const L = leaflet()
    const markers = []
    for (const feature of geojson?.features || []) {
        for (const point of interfacesOf(feature, opts)) {
            markers.push(
                L.circleMarker([point.lat, point.lng], {
                    radius: opts.radius,
                    color: '#222',
                    weight: 1,
                    fillColor: depthColor(point.depth, opts.maxDepthMeters),
                    fillOpacity: 0.9,
                }).bindTooltip(`${Math.round(point.depth)} m`)
            )
        }
    }
    return markers
}

function make(ctx) {
    const opts = optionsOf(ctx.config)
    return {
        on: ctx.config?.initialVisibility !== false,
        type: 'subsurface_interfaces',
        geojson: ctx.geojson,
        layer: leaflet().layerGroup(markersOf(ctx.geojson, opts)),
        // syncData is handed new data but not the config.
        _opts: opts,
    }
}

/**
 * The host's data changed. The core default re-adds the host's GeoJSON to this
 * layer, which is wrong here: these are derived markers in a layerGroup.
 */
function syncData(attachment, { geojson, onlyClear }) {
    attachment.layer.clearLayers()
    if (onlyClear) return
    markersOf(geojson, attachment._opts).forEach((m) =>
        attachment.layer.addLayer(m)
    )
}

export default { make, syncData }
