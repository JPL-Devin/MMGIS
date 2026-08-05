/**
 * GroundTrack layer type — extends `vector`.
 *
 * An orbiter's ground track, clipped to the mission clock's window. Drawing,
 * picking, filtering and both globes are inherited from `vector`; only the
 * `source` and `config` surfaces are ours.
 *
 * Time: the layer is time-enabled (`capabilities.time`), so a time change makes
 * core re-acquire — `fetch` is called again with `ctx.time` and returns only the
 * part of the track inside the window.
 */
import { syntheticTrack, clipToWindow } from '../../shared/comms'

const num = (v, d) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : d)

async function fetch(layerObj, ctx) {
    const v = layerObj?.variables || {}
    const timesProp = v.timesProp || 'times'
    const startMs = Date.parse(ctx?.time?.start) || Date.now()
    const endMs = Date.parse(ctx?.time?.end) || startMs + 6 * 3600 * 1000

    let collection
    if (ctx?.url) {
        const res = await window.fetch(ctx.url, {
            headers: { Accept: 'application/geo+json' },
        })
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        collection = await res.json()
    } else {
        // No service configured: propagate a circular orbit over the window so
        // the layer is demonstrable from config alone.
        collection = syntheticTrack({
            startMs,
            durationSec: Math.max(600, (endMs - startMs) / 1000),
            stepSec: num(v.stepSeconds, 60),
            periodSec: num(v.orbitPeriodSeconds, 7000),
            inclinationDeg: num(v.inclinationDeg, 92),
            altitudeMeters: num(v.altitudeMeters, 400000),
            bodyRotationSec: num(v.bodyRotationSeconds, 88642),
            name: layerObj?.name || 'Orbiter',
        })
    }

    const features = (collection.features || [])
        .map((f) => clipToWindow(f, startMs, endMs, timesProp) || null)
        .filter(Boolean)
    return { type: 'FeatureCollection', features }
}

const GroundTrack = {
    source: { fetch },
}

export default GroundTrack
