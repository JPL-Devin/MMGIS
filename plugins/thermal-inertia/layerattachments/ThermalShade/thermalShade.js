/**
 * ThermalShade attachment — shades each of the host's features by its derived
 * apparent thermal inertia.
 *
 * The derivation and the colour ramp live in the container's shared lib, so this
 * module has no `src/essence` imports and stays importable in a Node unit test;
 * Leaflet is read from the global per call for the same reason.
 *
 * The day/night property names and the model constant come in as `ctx.config`.
 * On a `thermalinertia` layer that is what the layer type declared in
 * capabilities.defaultAttachments (with the layer's own settings on top); on any
 * other vector/query layer it is what an admin typed into the Configure form.
 * Either way this plugin only reads its own `configPath` — it never learns which.
 */
import {
    inertiaOfFeature,
    colorForInertia,
    DEFAULTS,
} from '../../lib/thermalInertia'

const leaflet = () => window.L

function styleForFeature(feature, config) {
    const derived = inertiaOfFeature(feature, config)
    const color = derived
        ? colorForInertia(derived.inertia, config)
        : '#888888'
    return {
        color,
        fillColor: color,
        fillOpacity: 0.85,
        weight: 1,
        radius: 7,
    }
}

function buildLayer(geojson, config) {
    const L = leaflet()
    return L.geoJson(geojson, {
        pointToLayer: (feature, latlng) =>
            L.circleMarker(latlng, styleForFeature(feature, config)),
        style: (feature) => styleForFeature(feature, config),
    })
}

/**
 * @param {Object} ctx
 * @param {Object} ctx.geojson  The host's features.
 * @param {Object} ctx.config   This attachment's settings (its `configPath`, or
 *   the host type's defaultAttachments settings with the layer's on top).
 * @returns {Object|false}
 */
function make(ctx) {
    const config = ctx.config || {}
    return {
        on: config.initialVisibility !== false,
        type: 'thermal_shade',
        geojson: ctx.geojson,
        layer: buildLayer(ctx.geojson, config),
        // Kept so syncData can recolour without being handed the config again.
        _config: config,
    }
}

/**
 * The host's data changed. The core default re-adds the host's GeoJSON to our
 * layer, which would keep our layer's own `pointToLayer`/`style` — but only
 * because our subset equals the host's here. Rebuilding is explicit and also
 * re-derives colours if the new features carry different temperatures.
 */
function syncData(attachment, ctx) {
    attachment.layer.clearLayers()
    if (ctx.onlyClear) return
    const config = ctx.config || attachment._config || {}
    attachment.layer.addData(ctx.geojson)
    // addData reuses the layer's original options, so recolour by re-styling.
    attachment.layer.eachLayer((l) => {
        if (l.feature && l.setStyle)
            l.setStyle(styleForFeature(l.feature, config))
    })
    attachment.geojson = ctx.geojson
}

/**
 * Settings changed in place (a new property name or scale). Retune the existing
 * layer rather than pay for the core default, which rebuilds the whole host.
 */
function onConfigChange(ctx) {
    const attachment = ctx.attachment
    if (!attachment || !attachment.layer) return
    const config = ctx.config || {}
    attachment._config = config
    attachment.layer.eachLayer((l) => {
        if (l.feature && l.setStyle)
            l.setStyle(styleForFeature(l.feature, config))
    })
}

// Exported for the unit test.
export { styleForFeature, DEFAULTS }

const ThermalShade = { make, syncData, onConfigChange }

export default ThermalShade
