/**
 * EventHalo — a halo around each mission event that grows with how far the event
 * has progressed at the playhead.
 *
 * The halo follows the *playhead*, not the host's data, so it subscribes to
 * TimeControl as plugins/core/layerattachments/README.md describes.
 */
import TimeControl from '@basics/TimeControl_/TimeControl'
import { eventProgress, DURATION_PROP, DEFAULT_START_PROP, DEFAULT_END_PROP } from '../../lib/eventTime'

const leaflet = () => window.L
const num = (v, fallback) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback)

const propsOf = (layerObj) => ({
    startProp: layerObj?.time?.startProp || DEFAULT_START_PROP,
    endProp: layerObj?.time?.endProp || DEFAULT_END_PROP,
})

function halosOf(geojson, layerObj, config) {
    const { startProp, endProp } = propsOf(layerObj)
    const durationProp = config?.durationProp || DURATION_PROP
    const maxRadius = num(config?.maxRadiusMeters, 400)
    const maxDuration = Math.max(
        1,
        ...(geojson?.features || []).map((f) => num(f.properties?.[durationProp], 0))
    )
    const now = TimeControl.enabled ? TimeControl.getTime() : null

    return (geojson?.features || [])
        .filter((f) => f.geometry?.type === 'Point')
        .map((f) => {
            const [lng, lat] = f.geometry.coordinates
            const progress = eventProgress(
                f.properties?.[startProp],
                f.properties?.[endProp],
                now
            )
            if (progress == null) return null
            const full = (num(f.properties?.[durationProp], 0) / maxDuration) * maxRadius
            return leaflet().circle([lat, lng], {
                radius: Math.max(1, full * progress),
                fill: true,
                fillOpacity: 0.12,
                weight: 1,
            })
        })
        .filter(Boolean)
}

function redraw(attachment) {
    attachment.layer.clearLayers()
    halosOf(attachment.geojson, attachment._layerObj, attachment._config).forEach((h) =>
        attachment.layer.addLayer(h)
    )
}

function make(ctx) {
    const attachment = {
        on: ctx.config?.initialVisibility !== false,
        type: 'event_halo',
        geojson: ctx.geojson,
        layer: leaflet().layerGroup(
            halosOf(ctx.geojson, ctx.layerObj, ctx.config)
        ),
        // Kept for the redraws below, which are handed neither of these.
        _layerObj: ctx.layerObj,
        _config: ctx.config,
        _fid: `event_halo_${ctx.hostName}`,
    }
    TimeControl.subscribe(attachment._fid, () => redraw(attachment))
    return attachment
}

/** Derived circles in a layerGroup, so core's re-addData default is wrong. */
function syncData(attachment, { geojson, onlyClear, layerObj, config }) {
    attachment.geojson = geojson
    if (layerObj) attachment._layerObj = layerObj
    if (config) attachment._config = config
    attachment.layer.clearLayers()
    if (onlyClear) return
    redraw(attachment)
}

function onConfigChange(ctx) {
    if (!ctx.attachment) return
    ctx.attachment._config = ctx.config
    redraw(ctx.attachment)
}

function destroy(attachment) {
    if (attachment?._fid) TimeControl.unsubscribe(attachment._fid)
}

const EventHalo = { make, syncData, onConfigChange, destroy }

export default EventHalo
