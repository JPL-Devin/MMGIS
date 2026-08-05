/**
 * Range-rings attachment — concentric circles about a host layer's point
 * features, one per configured ring: comm range, drive range, keep-out zones.
 *
 * The interesting surface is the manifest's Configure form: the rings are an
 * `objectarray`, so an admin adds, colours and labels rings without any code.
 * Geometry lives in ./rings.js, which imports nothing from src/essence so it
 * can be unit tested in Node.
 */

import { ringPolygons, styleOf, labelFor } from './rings'

const leaflet = () => window.L

/** Radius of the body being mapped, in metres, defaulting to Earth's. */
const bodyRadius = () =>
    parseFloat(window.mmgisglobal?.customCRS?.radius) || 6378137

const bindLabels = (config) => (feature, layer) => {
    const text = labelFor(feature, config)
    if (text == null) return
    layer.bindTooltip(text, {
        permanent: config?.labelsOnHover !== true,
        direction: 'center',
        className: 'rangeRingsLabel',
        opacity: 0.85,
    })
}

const geojsonOptions = (config) => ({
    style: styleOf(config),
    onEachFeature: bindLabels(config),
})

function make(ctx) {
    const { geojson, config } = ctx
    if (config?.enabled === false) return false

    return {
        on: config?.initialVisibility !== false,
        type: 'range_rings',
        geojson,
        layer: leaflet().geoJson(
            ringPolygons(geojson, config, bodyRadius()),
            geojsonOptions(config)
        ),
    }
}

/**
 * Rings depend only on this attachment's own settings and are cheap to
 * recompute, so retune in place rather than paying for core's default, which
 * rebuilds the whole host layer.
 */
function onConfigChange(ctx) {
    const { attachment, config } = ctx
    if (!attachment?.layer) return
    attachment.layer.clearLayers()
    Object.assign(attachment.layer.options, geojsonOptions(config))
    attachment.layer.addData(
        ringPolygons(attachment.geojson, config, bodyRadius())
    )
}

/** The host's features moved, so recompute the rings rather than re-add them. */
function syncData(attachment, ctx) {
    if (!attachment?.layer) return
    attachment.layer.clearLayers()
    if (ctx.onlyClear) return
    attachment.geojson = ctx.geojson || attachment.geojson
    attachment.layer.addData(
        ringPolygons(attachment.geojson, ctx.config, bodyRadius())
    )
}

export default {
    make,
    onConfigChange,
    syncData,
}
