/**
 * seismic:summary — summarise the clicked event and highlight the events near it
 * in time, including their MagnitudeRings rings when that attachment is on.
 *
 * The pure half lives in `lib/summary.js` so it can be unit tested; this module
 * imports `L_` and therefore needs the app's globals.
 */
import L_ from '@basics/Layers_/Layers_'

import { temporalNeighbors, summaryHtml, eventId } from './lib/summary'

const num = (v, fallback) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback)

// The rings/features this interaction restyled, so the next click can undo it.
let highlighted = []

/** Every feature the host layer is currently holding, with its Leaflet layer. */
function hostFeatures(layerName) {
    const host = L_.layers.layer[layerName]
    const out = []
    if (host && typeof host.eachLayer === 'function')
        host.eachLayer((l) => {
            if (l?.feature) out.push({ feature: l.feature, layer: l })
        })
    return out
}

/**
 * The MagnitudeRings attachment's rings, keyed by the feature id the attachment
 * tagged them with. `magnitude_rings` is the attachment's `attachmentId`, which
 * is also its default `sublayerKey` — the only handle one plugin family has on
 * another.
 */
function ringsById(layerName) {
    const attachment = L_.layers.attachments?.[layerName]?.magnitude_rings
    const byId = {}
    if (attachment?.layer?.eachLayer)
        attachment.layer.eachLayer((ring) => {
            if (ring._seismicFeatureId != null) byId[ring._seismicFeatureId] = ring
        })
    return byId
}

function clearHighlight() {
    highlighted.forEach(({ layer, style }) => {
        try {
            layer.setStyle?.(style)
        } catch (e) {
            /* the layer went away with a refetch */
        }
    })
    highlighted = []
}

function highlight(layer, style) {
    if (!layer?.setStyle) return
    const base = layer._seismicBaseStyle || { color: layer.options?.color, weight: layer.options?.weight }
    highlighted.push({ layer, style: base })
    layer.setStyle(style)
}

const SeismicSummary = {
    use(ctx) {
        clearHighlight()
        if (!ctx.feature) return

        const { windowMinutes = 60, highlightColor = '#ffffff' } = ctx.config || {}
        const minutes = num(windowMinutes, 60)

        const all = hostFeatures(ctx.layerName)
        const neighbors = temporalNeighbors(
            all.map((f) => f.feature),
            ctx.feature,
            minutes
        )

        const rings = ringsById(ctx.layerName)
        const neighborIds = new Set(neighbors.map((n) => eventId(n.feature)))
        all.forEach(({ feature, layer }) => {
            if (!neighborIds.has(eventId(feature))) return
            highlight(layer, { color: highlightColor, weight: 3 })
            const ring = rings[eventId(feature)]
            if (ring) highlight(ring, { color: highlightColor, weight: 3 })
        })

        const html = summaryHtml(ctx.feature, neighbors, minutes)
        if (ctx.event?.latlng && ctx.Map_?.map) {
            window.L.popup({ className: 'seismicSummaryPopup', maxWidth: 360 })
                .setLatLng(ctx.event.latlng)
                .setContent(html)
                .openOn(ctx.Map_.map)
        }

        // Anything later in the pipeline (info:open, notifications) can reuse this.
        ctx.state.seismic = {
            feature: ctx.feature,
            neighbors,
            windowMinutes: minutes,
            summaryHtml: html,
        }
    },
}

export default SeismicSummary
