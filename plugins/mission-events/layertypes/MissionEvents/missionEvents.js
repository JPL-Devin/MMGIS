/**
 * MissionEvents layer type — extends `vector`.
 *
 * Discrete mission events (drives, drills, anomalies) that each occupy a span of
 * time. Drawing, picking, filtering and both globes are inherited from `vector`;
 * this module owns only what time means to the type and how its data arrives.
 */
import { eventDurationSec, DEFAULT_START_PROP, DEFAULT_END_PROP } from '../../lib/eventTime'

/**
 * Give a mission author working defaults for the time properties this type's
 * siblings (EventHalo, EventSeek, EventTimeline) also read.
 */
function normalize(layerObj) {
    layerObj.time = layerObj.time || {}
    if (layerObj.time.enabled == null) layerObj.time.enabled = true
    if (!layerObj.time.startProp) layerObj.time.startProp = DEFAULT_START_PROP
    if (!layerObj.time.endProp) layerObj.time.endProp = DEFAULT_END_PROP
    return layerObj
}

/**
 * Events come out of an ordinary GeoJSON url, but each feature is stamped with a
 * duration in seconds so the mission's `style` can say `prop-durationSec` and so
 * the halo attachment has a number to size itself by without re-parsing dates.
 */
async function fetch(layerObj, ctx) {
    if (!ctx.url) return null
    const res = await window.fetch(ctx.url, {
        headers: { Accept: 'application/geo+json' },
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    const geojson = await res.json()

    const startProp = layerObj.time?.startProp || DEFAULT_START_PROP
    const endProp = layerObj.time?.endProp || DEFAULT_END_PROP
    ;(geojson?.features || []).forEach((f) => {
        if (!f.properties) f.properties = {}
        f.properties.durationSec = eventDurationSec(
            f.properties[startProp],
            f.properties[endProp]
        )
    })
    return geojson
}

/**
 * Events are fetched as a whole set and filtered client-side by the inherited
 * vector renderer, so the window never needs to reach the request. Stamping the
 * window onto the layer is what keeps core from reloading it on every time move.
 */
function applyTimeParams(layerObj, ctx) {
    layerObj._missionEventsWindow = { start: ctx?.startTime, end: ctx?.endTime }
}

const MissionEvents = {
    config: { normalize },
    source: { fetch },
    time: { applyTimeParams },
}

export default MissionEvents
