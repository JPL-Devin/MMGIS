/**
 * PropertyBubbles attachment — proportional-symbol bubbles over a host layer.
 *
 * A circle at each point feature, its radius scaled by a numeric property and
 * its color taken from a two-stop ramp across that property's range: the usual
 * way to read "how much" across a science-target layer at a glance.
 *
 * Every one of its settings is a thing you retune by eye — which property, how
 * big, which colors — so it implements `onConfigChange` and restyles in place
 * rather than paying for core's default host rebuild.
 */

/**
 * Read lazily, not as an import-time `const L = window.L`: the scaffolded unit
 * test has to assign `window.L` itself, and an import-time capture happens
 * before it can.
 */
const leaflet = () => window.L

/**
 * The README's example reaches for `F_.getIn`, but importing
 * `@basics/Formulae_/Formulae_` pulls in `file-saver` and blows up the
 * scaffolded unit test outside a browser, so this is the same two lines.
 */
const getIn = (obj, key, fallback) =>
    obj != null && obj[key] != null ? obj[key] : fallback

const optsFrom = (config) => ({
    property: getIn(config, 'property', null),
    minRadius: parseFloat(getIn(config, 'minRadius', 4)) || 4,
    maxRadius: parseFloat(getIn(config, 'maxRadius', 20)) || 20,
    lowColor: getIn(config, 'lowColor', '#2c7bb6'),
    highColor: getIn(config, 'highColor', '#d7191c'),
    fillOpacity: parseFloat(getIn(config, 'fillOpacity', 0.6)),
})

const valueOf = (feature, property) => {
    if (!property) return null
    const v = parseFloat(getIn(feature.properties, property, null))
    return Number.isFinite(v) ? v : null
}

/** The property's [min, max] across the host's features, for normalization. */
const rangeOf = (geojson, property) => {
    let min = Infinity
    let max = -Infinity
    ;(geojson?.features || []).forEach((f) => {
        const v = valueOf(f, property)
        if (v == null) return
        if (v < min) min = v
        if (v > max) max = v
    })
    return min <= max ? [min, max] : [0, 1]
}

const hexToRgb = (hex) => {
    const h = hex.replace('#', '')
    const full =
        h.length === 3
            ? h
                  .split('')
                  .map((c) => c + c)
                  .join('')
            : h
    return [
        parseInt(full.slice(0, 2), 16),
        parseInt(full.slice(2, 4), 16),
        parseInt(full.slice(4, 6), 16),
    ]
}

const rampColor = (t, lowColor, highColor) => {
    const a = hexToRgb(lowColor)
    const b = hexToRgb(highColor)
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * t))
    return `rgb(${c[0]},${c[1]},${c[2]})`
}

/** The style one feature's bubble gets under `opts`, given the data's range. */
const styleFor = (value, [min, max], opts) => {
    const t = max > min && value != null ? (value - min) / (max - min) : 0
    return {
        radius: opts.minRadius + (opts.maxRadius - opts.minRadius) * t,
        color: rampColor(t, opts.lowColor, opts.highColor),
        fillColor: rampColor(t, opts.lowColor, opts.highColor),
        fillOpacity: opts.fillOpacity,
        weight: 1,
    }
}

const bubblesOf = (geojson, opts) => {
    const range = rangeOf(geojson, opts.property)
    const bubbles = []
    ;(geojson?.features || []).forEach((f) => {
        if (f.geometry?.type !== 'Point') return
        const value = valueOf(f, opts.property)
        if (value == null) return
        const [lng, lat] = f.geometry.coordinates
        const marker = leaflet().circleMarker(
            [lat, lng],
            styleFor(value, range, opts)
        )
        // Kept so onConfigChange can restyle without re-reading the geojson.
        marker._bubbleValue = value
        marker.bindTooltip(`${opts.property}: ${value}`, { sticky: true })
        bubbles.push(marker)
    })
    return { bubbles, range }
}

function make({ geojson, config }) {
    const opts = optsFrom(config)
    const { bubbles, range } = bubblesOf(geojson, opts)

    return {
        on: getIn(config, 'initialVisibility', true),
        type: 'property_bubbles',
        geojson,
        layer: leaflet().layerGroup(bubbles),
        // syncData and onConfigChange are not handed both of these.
        _opts: opts,
        _range: range,
    }
}

/**
 * The core default re-adds the host's GeoJSON, which is wrong: these are derived
 * circleMarkers in a layerGroup, and the property's range moves with the data.
 */
function syncData(attachment, { geojson, onlyClear }) {
    attachment.layer.clearLayers()
    if (onlyClear) return
    attachment.geojson = geojson
    const { bubbles, range } = bubblesOf(geojson, attachment._opts)
    attachment._range = range
    bubbles.forEach((b) => attachment.layer.addLayer(b))
}

/**
 * Settings changed. The core default rebuilds the whole host layer; only the
 * bubbles depend on these settings, so retune them in place. Changing the
 * property changes which features have a bubble at all, so that case rebuilds
 * the attachment's own layer — still not the host's.
 */
function onConfigChange({ attachment, config, prevConfig }) {
    if (attachment == null) return
    const opts = optsFrom(config)
    attachment._opts = opts

    if (opts.property !== optsFrom(prevConfig || {}).property) {
        syncData(attachment, { geojson: attachment.geojson })
        return
    }

    attachment.layer.eachLayer((marker) => {
        marker.setStyle(styleFor(marker._bubbleValue, attachment._range, opts))
        marker.setRadius(
            styleFor(marker._bubbleValue, attachment._range, opts).radius
        )
    })
}

export default { make, syncData, onConfigChange }
