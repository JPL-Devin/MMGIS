/**
 * GraduatedSymbols attachment — proportional circles over a host layer's points,
 * sized by a numeric property and filled from configurable value breaks.
 *
 * Only `make` is required; `syncData` and `onConfigChange` are here because the
 * core defaults (re-add the host's GeoJSON / rebuild the host layer) are wrong
 * for derived circles that can be restyled in place.
 */

// Read at call time, not import time, so the module can be imported (and unit
// tested) before Leaflet is on the window.
const leaflet = () => window.L

const DEFAULTS = {
    scale: 'sqrt',
    minRadius: 4,
    maxRadius: 20,
    fillOpacity: 0.6,
    weight: 1,
    strokeColor: '#222222',
    fallbackColor: '#888888',
}

const num = (value) => {
    const parsed = typeof value === 'string' ? parseFloat(value) : value
    return typeof parsed === 'number' && isFinite(parsed) ? parsed : null
}

// The settings a symbol depends on, normalized once per build/retune.
const readSettings = (config) => {
    const c = config || {}
    const breaks = (Array.isArray(c.breaks) ? c.breaks : [])
        .map((b) => ({
            value: num(b?.value),
            color: b?.color || DEFAULTS.fallbackColor,
            label: b?.label || null,
        }))
        .filter((b) => b.value != null)
        .sort((a, b) => a.value - b.value)

    return {
        property: typeof c.property === 'string' ? c.property : null,
        scale: ['sqrt', 'linear', 'log'].includes(c.scale)
            ? c.scale
            : DEFAULTS.scale,
        autoDomain: c.autoDomain !== false,
        minValue: num(c.minValue),
        maxValue: num(c.maxValue),
        minRadius: num(c.minRadius) ?? DEFAULTS.minRadius,
        maxRadius: num(c.maxRadius) ?? DEFAULTS.maxRadius,
        fillOpacity: num(c.fillOpacity) ?? DEFAULTS.fillOpacity,
        weight: num(c.weight) ?? DEFAULTS.weight,
        strokeColor: c.strokeColor || DEFAULTS.strokeColor,
        breaks,
    }
}

const valuesOf = (geojson, property) =>
    (geojson?.features || [])
        .map((f) => num(f?.properties?.[property]))
        .filter((v) => v != null)

// Fixed domain unless autoDomain, and never a zero-width one.
const domainOf = (geojson, settings) => {
    let min = settings.minValue
    let max = settings.maxValue

    if (settings.autoDomain || min == null || max == null) {
        const values = valuesOf(geojson, settings.property)
        if (values.length === 0) return null
        min = Math.min(...values)
        max = Math.max(...values)
    }
    if (max === min) max = min + 1

    return { min, max }
}

const radiusFor = (value, settings, domain) => {
    const { min, max } = domain
    const clamped = Math.min(Math.max(value, min), max)

    let t
    if (settings.scale === 'log') {
        const shift = min <= 0 ? 1 - min : 0
        t =
            (Math.log(clamped + shift) - Math.log(min + shift)) /
            (Math.log(max + shift) - Math.log(min + shift))
    } else {
        t = (clamped - min) / (max - min)
        if (settings.scale === 'sqrt') t = Math.sqrt(t)
    }
    if (!isFinite(t)) t = 0

    return settings.minRadius + t * (settings.maxRadius - settings.minRadius)
}

const breakFor = (value, settings) => {
    let match = null
    settings.breaks.forEach((b) => {
        if (value >= b.value) match = b
    })
    return match || settings.breaks[settings.breaks.length - 1] || null
}

const styleFor = (value, settings, domain) => {
    const bucket = breakFor(value, settings)
    return {
        radius: radiusFor(value, settings, domain),
        color: settings.strokeColor,
        weight: settings.weight,
        fillColor: bucket ? bucket.color : DEFAULTS.fallbackColor,
        fillOpacity: settings.fillOpacity,
        fill: true,
    }
}

const tooltipFor = (value, settings) => {
    const bucket = breakFor(value, settings)
    const label = bucket && bucket.label ? ` (${bucket.label})` : ''
    return `${settings.property}: ${value}${label}`
}

// One circleMarker per point feature that has a numeric value.
const symbolsOf = (geojson, settings) => {
    const domain = domainOf(geojson, settings)
    if (settings.property == null || domain == null) return []

    return (geojson?.features || [])
        .map((feature) => {
            if (feature?.geometry?.type !== 'Point') return null
            const value = num(feature.properties?.[settings.property])
            if (value == null) return null

            const [lng, lat] = feature.geometry.coordinates
            const marker = leaflet().circleMarker(
                [lat, lng],
                styleFor(value, settings, domain)
            )
            marker.bindTooltip(tooltipFor(value, settings))
            marker._gsValue = value
            return marker
        })
        .filter((marker) => marker != null)
}

function make({ geojson, config }) {
    const settings = readSettings(config)

    return {
        on: config?.initialVisibility !== false,
        type: 'graduated_symbols',
        geojson,
        layer: leaflet().layerGroup(symbolsOf(geojson, settings)),
        // syncData is handed new data but not the config, and onConfigChange
        // needs the data it last drew, so both are kept on the attachment.
        _settings: settings,
    }
}

/**
 * The host's data changed. The core default re-adds the host's GeoJSON to the
 * attachment's layer, which is meaningless for a layerGroup of derived circles,
 * and an auto domain has to be recomputed anyway.
 */
function syncData(attachment, { geojson, onlyClear }) {
    attachment.layer.clearLayers()
    if (onlyClear) return
    attachment.geojson = geojson
    symbolsOf(geojson, attachment._settings).forEach((marker) =>
        attachment.layer.addLayer(marker)
    )
}

/**
 * Settings changed while built. The core default rebuilds the whole host layer;
 * a ramp/domain/radius change only needs the circles restyled, and a property
 * change only needs them rebuilt from the data already held.
 */
function onConfigChange(ctx) {
    const attachment = ctx.attachment
    if (attachment == null) return

    const previous = attachment._settings
    const settings = (attachment._settings = readSettings(ctx.config))

    if (settings.property !== previous.property) {
        syncData(attachment, { geojson: attachment.geojson })
        return
    }

    const domain = domainOf(attachment.geojson, settings)
    if (domain == null) return

    attachment.layer.eachLayer((marker) => {
        const value = marker._gsValue
        if (value == null) return
        marker.setStyle(styleFor(value, settings, domain))
        if (marker.setRadius) marker.setRadius(radiusFor(value, settings, domain))
        marker.setTooltipContent(tooltipFor(value, settings))
    })
}

export default { make, syncData, onConfigChange }
