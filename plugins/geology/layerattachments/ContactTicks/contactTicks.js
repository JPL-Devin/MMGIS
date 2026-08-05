/**
 * ContactTicks attachment — strike/dip ticks and certainty dashes on a host
 * layer's contact lines.
 *
 * `make` builds a layerGroup of derived polylines, so the core `syncData`
 * default (clear + re-add the host's GeoJSON) is wrong and is overridden. All
 * the geometry is in lib/contactGeometry.js, which imports nothing and is what
 * the unit test covers. See plugins/core/layerattachments/README.md.
 */
import { contactRenderables } from './lib/contactGeometry'

// Read Leaflet per call, not at import time, so this module stays importable
// (and its geometry unit-testable) outside the browser.
const leaflet = () => window.L

const TICK_COLOR = '#8c5a2b'
const LINE_COLOR = '#222222'

function buildLayers(geojson, config) {
    const L = leaflet()
    return contactRenderables(geojson, config).map((r) => {
        const line = L.polyline(r.latlngs, {
            color: r.type === 'tick' ? TICK_COLOR : LINE_COLOR,
            weight: r.type === 'tick' ? 3 : 2,
            dashArray: r.dashArray || undefined,
        })
        if (r.tooltip) line.bindTooltip(r.tooltip, { sticky: true })
        return line
    })
}

function make(ctx) {
    const config = ctx.config || {}
    return {
        on: config.initialVisibility !== false,
        type: 'contact_ticks',
        // The subset we actually drew (lines only); kept so syncData can rebuild.
        geojson: ctx.geojson,
        layer: leaflet().layerGroup(buildLayers(ctx.geojson, config)),
        // config isn't handed to syncData, so keep what a rebuild needs.
        _config: config,
    }
}

/**
 * Host data changed. The core default re-adds the host's GeoJSON to our layer,
 * which would draw the raw features, not our derived ticks — so rebuild them.
 */
function syncData(attachment, ctx) {
    const group = attachment.layer
    group.clearLayers()
    if (ctx.onlyClear) return
    buildLayers(ctx.geojson, attachment._config || {}).forEach((l) =>
        group.addLayer(l)
    )
}

const ContactTicks = {
    make,
    syncData,
}

export default ContactTicks
