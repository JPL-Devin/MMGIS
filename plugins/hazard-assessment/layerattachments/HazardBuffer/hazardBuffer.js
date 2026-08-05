/**
 * HazardBuffer attachment — a keep-out buffer around every hazard feature of its
 * host, at a distance that scales with that hazard's severity and class.
 *
 * The property names holding severity and class are the *layer type's* fact, and
 * arrive here through `ctx.config`: HazardZone declares them in its
 * `capabilities.defaultAttachments.hazard_buffer`, and core hands them over as
 * if an admin had filled this attachment's form in. Nothing here reads the
 * host's config or the type's manifest.
 *
 * The buffers it computed are left on the returned attachment object
 * (`_buffers`), which core stores verbatim at
 * `L_.layers.attachments[host].hazard_buffer` — that is how the HazardReport
 * interaction learns where the buffers are without calling this plugin.
 */
import { buffersOf } from '../../lib/hazardGeometry'

// Read Leaflet off the window per call, not at import time, so this module can
// be imported (and unit tested) outside the browser.
const leaflet = () => window.L

const SEVERITY_COLOR = (severity) =>
    severity >= 0.66 ? '#bd0026' : severity >= 0.33 ? '#fd8d3c' : '#ffffb2'

const circlesOf = (buffers) =>
    buffers.map((b) =>
        leaflet().circle([b.center[1], b.center[0]], {
            radius: b.radiusMeters,
            color: SEVERITY_COLOR(b.severity),
            weight: 2,
            dashArray: '6 4',
            fill: true,
            fillOpacity: 0.08,
        })
    )

function make(ctx) {
    const buffers = buffersOf(ctx.geojson, ctx.config)

    return {
        on: ctx.config?.initialVisibility !== false,
        type: 'hazard_buffer',
        geojson: ctx.geojson,
        layer: leaflet().layerGroup(circlesOf(buffers)),
        // Stashed for syncData, and read by the HazardReport interaction.
        _buffers: buffers,
        _config: ctx.config || {},
    }
}

/**
 * The host's data changed. The core default re-adds the host's GeoJSON to this
 * attachment's layer, which is wrong here: these are derived circles in a
 * layerGroup, so they are recomputed.
 */
function syncData(attachment, { geojson, onlyClear, config }) {
    attachment.layer.clearLayers()
    attachment._buffers = []
    if (onlyClear) return

    const resolved = config || attachment._config
    const buffers = buffersOf(geojson, resolved)
    attachment.geojson = geojson
    attachment._buffers = buffers
    attachment._config = resolved
    circlesOf(buffers).forEach((c) => attachment.layer.addLayer(c))
}

/**
 * Buffer distances changed. The core default rebuilds the whole host layer;
 * recomputing the circles in place is enough.
 */
function onConfigChange(ctx) {
    if (!ctx.attachment) return
    ctx.attachment._config = ctx.config || {}
    syncData(ctx.attachment, {
        geojson: ctx.attachment.geojson,
        config: ctx.attachment._config,
    })
}

const HazardBuffer = {
    make,
    syncData,
    onConfigChange,
}

export default HazardBuffer
