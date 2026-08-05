/**
 * TruthOffset — draws, on a predictions layer, how far each prediction is from
 * the ground-truth feature it predicts, in a *different* layer.
 *
 * The awkward part is deliberate and is the finding of this exercise: an
 * attachment is handed only its host (`ctx.geojson`, `ctx.layerObj`). There is
 * no peer-layer data in any context, so the ground truth has to be pulled out
 * of the `L_` singleton by name — see `truthFeatures` below. Core's own
 * Pairings attachment does the same thing, so this is the sanctioned path, not
 * a hack; it is just not a seam.
 */
import L_ from '@basics/Layers_/Layers_'

import { pairAll, offsetColor, OFFSET_PROP, MATCH_ID_PROP } from '../../lib/crossref'

const leaflet = () => window.L

const settings = (config) => ({
    layers: config?.truthLayers || [],
    matchProp: config?.matchProp || MATCH_ID_PROP,
    maxDistanceMeters: parseFloat(config?.maxDistanceMeters) || Infinity,
    worstMeters: parseFloat(config?.worstMeters) || 1000,
    weight: parseFloat(config?.style?.weight) || 2,
    showLabels: config?.showLabels !== false,
})

/**
 * The features of the ground-truth layers, by display name or UUID.
 *
 * This is the reach across layers. `L_.layers.layer[name]` is a live Leaflet
 * layer, so the GeoJSON comes back out of it with `toGeoJSON()`; a layer that
 * is off, or not yet made, simply contributes nothing — which is why
 * `onPeerToggle` exists below.
 */
function truthFeatures(names) {
    const out = []
    for (const rawName of names) {
        const name = L_.asLayerUUID ? L_.asLayerUUID(rawName) : rawName
        const live = L_.layers?.layer?.[name]
        if (!live) continue
        const collections = Array.isArray(live) ? live : [live]
        for (const c of collections) {
            const gj = typeof c?.toGeoJSON === 'function' ? c.toGeoJSON() : null
            for (const f of gj?.features || []) out.push({ ...f, _layerName: name })
        }
    }
    return out
}

function drawnPairs(geojson, opts) {
    const truths = truthFeatures(opts.layers)
    if (!truths.length) return { pairs: [], lines: [] }

    const pairs = pairAll(geojson?.features || [], truths, {
        matchProp: opts.matchProp,
        maxDistanceMeters: opts.maxDistanceMeters,
    })

    const lines = pairs.map((p) => {
        const line = leaflet().polyline(
            [
                [p.from[1], p.from[0]],
                [p.to[1], p.to[0]],
            ],
            {
                color: offsetColor(p.distance, opts.worstMeters),
                weight: opts.weight,
                dashArray: '4 4',
            }
        )
        // The offset is the number the whole feature is about, so it is written
        // back onto the prediction feature: the interaction reports it and the
        // host's own `style` can colour by it with `prop-<OFFSET_PROP>`.
        if (p.prediction.properties)
            p.prediction.properties[OFFSET_PROP] = Math.round(p.distance)
        if (opts.showLabels)
            line.bindTooltip(`${Math.round(p.distance)} m`, { sticky: true })
        return line
    })
    return { pairs, lines }
}

function make(ctx) {
    const opts = settings(ctx.config)
    const { pairs, lines } = drawnPairs(ctx.geojson, opts)

    return {
        on: ctx.config?.initialVisibility !== false,
        type: 'truth_offset',
        geojson: ctx.geojson,
        layer: leaflet().layerGroup(lines),
        _opts: opts,
        _pairs: pairs,
    }
}

/** Derived lines, not the host's GeoJSON, so the core default is wrong. */
function syncData(attachment, { geojson, onlyClear }) {
    attachment.layer.clearLayers()
    attachment._pairs = []
    if (onlyClear) return
    const { pairs, lines } = drawnPairs(geojson, attachment._opts)
    attachment._pairs = pairs
    lines.forEach((l) => attachment.layer.addLayer(l))
    attachment.geojson = geojson
}

/**
 * A ground-truth layer being toggled changes what there is to compare against —
 * this attachment's whole point — so it redraws. Core hands us the name that
 * toggled but not its data, so this is a full recompute.
 */
function onPeerToggle(attachment, ctx) {
    const names = attachment._opts?.layers || []
    const toggled = L_.asLayerUUID ? L_.asLayerUUID(ctx.layerName) : ctx.layerName
    if (!names.some((n) => (L_.asLayerUUID ? L_.asLayerUUID(n) : n) === toggled)) return
    syncData(attachment, { geojson: attachment.geojson })
}

/** Retune without paying for a host rebuild. */
function onConfigChange(ctx) {
    if (!ctx.attachment) return
    ctx.attachment._opts = settings(ctx.config)
    syncData(ctx.attachment, { geojson: ctx.attachment.geojson })
}

/** What core asks when it wants a prediction's related features elsewhere. */
function peerFeaturesFor(attachment, ctx) {
    const feature = ctx.feature
    if (!feature) return false
    const pair = (attachment._pairs || []).find((p) => p.prediction === feature)
    if (!pair) return false
    return {
        origin: feature,
        layerNames: [pair.truth._layerName],
        peers: [pair.truth],
    }
}

const TruthOffset = { make, syncData, onPeerToggle, onConfigChange, peerFeaturesFor }

export default TruthOffset
