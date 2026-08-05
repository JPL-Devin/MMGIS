/**
 * TelemetryTrail attachment.
 *
 * Draws a trail (a polyline through the host's point features in time order)
 * and fades each point by its age relative to the mission clock's playhead:
 * points at/after the playhead are opaque, older ones fade out.
 *
 * The attachment family has no time hook — no operation is dispatched when the
 * playhead moves without the host's data changing — so this subscribes to the
 * mission clock (TimeControl) directly in `make` and unsubscribes in `destroy`,
 * the way a tool does. Both Leaflet and TimeControl are read off the window per
 * call (never imported), so the module stays importable in a Node unit test.
 */
import { timedPoints, fadeOpacity, parseTime, num } from './lib/fade'

const leaflet = () => window.L
const timeControl = () => (typeof window !== 'undefined' ? window.L_?.TimeControl_ : null)
const getIn = (obj, path) => {
    if (obj == null || path == null) return undefined
    return String(path)
        .split('.')
        .reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

function build(geojson, cfg) {
    const L = leaflet()
    const pts = timedPoints(geojson, cfg.startProp, cfg.endProp, getIn)
    const trail = L.polyline(
        pts.map((p) => p.latlng),
        { color: cfg.trailColor, weight: cfg.trailWeight, opacity: 0.85, interactive: false }
    )
    const markers = pts.map((p) =>
        L.circleMarker(p.latlng, {
            radius: cfg.radius,
            color: cfg.trailColor,
            weight: 1,
            fillColor: cfg.trailColor,
            fillOpacity: 1,
            interactive: false,
            _telemetryMs: p.ms,
        })
    )
    return { trail, markers, group: L.layerGroup([trail, ...markers]) }
}

function applyFade(attachment) {
    const tc = timeControl()
    const playheadMs = tc?.getTime ? parseTime(tc.getTime()) : null
    ;(attachment._markers || []).forEach((m) => {
        const ms = m.options?._telemetryMs
        const o = fadeOpacity(ms, playheadMs, attachment._fadeMs, attachment._minOpacity)
        if (m.setStyle) m.setStyle({ fillOpacity: o, opacity: Math.max(o, attachment._minOpacity) })
    })
}

function readConfig(config, layerObj) {
    return {
        startProp: layerObj?.time?.startProp,
        endProp: layerObj?.time?.endProp,
        trailColor: config?.trailColor || '#00e5ff',
        trailWeight: num(config?.trailWeight, 2),
        radius: num(config?.radius, 4),
        fadeMs: num(config?.fadeSeconds, 3600) * 1000,
        minOpacity: num(config?.minOpacity, 0.1),
    }
}

function make(ctx) {
    const cfg = readConfig(ctx.config, ctx.layerObj)
    const { group, markers } = build(ctx.geojson, cfg)

    const attachment = {
        on: ctx.config?.initialVisibility !== false,
        type: 'telemetry_trail',
        geojson: ctx.geojson,
        layer: group,
        _markers: markers,
        _cfg: cfg,
        _fadeMs: cfg.fadeMs,
        _minOpacity: cfg.minOpacity,
    }

    applyFade(attachment)

    // No time surface for attachments — subscribe to the clock ourselves.
    const tc = timeControl()
    if (tc?.subscribe) {
        attachment._subId = `telemetry_trail_${ctx.layerObj?.name || ctx.hostName || 'host'}`
        tc.subscribe(attachment._subId, () => applyFade(attachment))
    }

    return attachment
}

/**
 * Host data changed (core's default re-adds GeoJSON to a plain geoJson layer;
 * this is a layerGroup of a polyline + derived markers, so rebuild it).
 */
function syncData(attachment, ctx) {
    attachment.layer.clearLayers()
    if (ctx.onlyClear) {
        attachment._markers = []
        return
    }
    const { trail, markers, group } = build(ctx.geojson, attachment._cfg)
    void group
    attachment.layer.addLayer(trail)
    markers.forEach((m) => attachment.layer.addLayer(m))
    attachment._markers = markers
    attachment.geojson = ctx.geojson
    applyFade(attachment)
}

/** Release the clock subscription taken in make. */
function destroy(attachment) {
    const tc = timeControl()
    if (tc?.unsubscribe && attachment?._subId) tc.unsubscribe(attachment._subId)
}

// NOTE: the default export must be an object literal — the plugin module
// validator static-parses it and cannot follow a named const, though eslint
// would prefer one. (Also: avoid writing the export keyword in comments; the
// parser matches the first occurrence in the file.)
export default { make, syncData, destroy }
