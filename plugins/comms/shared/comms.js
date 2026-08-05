/**
 * Pure comms-geometry shared by all three plugins in this container.
 *
 * Nothing in here imports an MMGIS singleton, so every plugin can import it and
 * it stays unit-testable in Node. This is the container's own convention — the
 * docs do not describe a way for plugins of different families to share code.
 */

export const DEG = Math.PI / 180

/**
 * Radius on the ground within which an orbiter at `altitudeMeters` is above the
 * `elevationMaskDeg` horizon of a surface asset.
 * Spherical body of radius `bodyRadiusMeters`.
 */
export function footprintRadiusMeters(
    altitudeMeters,
    elevationMaskDeg = 10,
    bodyRadiusMeters = 3396190
) {
    const R = Number(bodyRadiusMeters)
    const h = Number(altitudeMeters)
    if (!Number.isFinite(R) || !Number.isFinite(h) || h <= 0) return 0
    const e = Number(elevationMaskDeg) * DEG
    // Central angle from the asset to the sub-satellite point at the mask.
    const lambda = Math.acos(Math.min(1, (R / (R + h)) * Math.cos(e))) - e
    return Math.max(0, R * lambda)
}

/** Great-circle distance in meters on a sphere. */
export function greatCircleMeters(a, b, bodyRadiusMeters = 3396190) {
    const [lng1, lat1] = a
    const [lng2, lat2] = b
    const dLat = (lat2 - lat1) * DEG
    const dLng = (lng2 - lng1) * DEG
    const s =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLng / 2) ** 2
    return 2 * bodyRadiusMeters * Math.asin(Math.min(1, Math.sqrt(s)))
}

/**
 * Samples of a ground-track feature as [[lng, lat], epochMs] pairs.
 * `timesProp` is the feature property holding one ISO time per coordinate.
 */
export function samplesOf(feature, timesProp = 'times') {
    const coords = feature?.geometry?.coordinates
    const times = feature?.properties?.[timesProp]
    if (!Array.isArray(coords) || !Array.isArray(times)) return []
    return coords
        .slice(0, times.length)
        .map((c, i) => ({ coord: c, t: Date.parse(times[i]) }))
        .filter((s) => Number.isFinite(s.t))
}

/**
 * The next contiguous run of samples inside `radiusMeters` of `asset`,
 * starting at or after `fromMs`.
 *
 * @returns {{startMs:number, endMs:number, closestMeters:number}|null}
 */
export function nextWindow(
    feature,
    asset,
    radiusMeters,
    fromMs = Date.now(),
    opts = {}
) {
    const { timesProp = 'times', bodyRadiusMeters = 3396190 } = opts
    const samples = samplesOf(feature, timesProp)
    let run = null
    for (const s of samples) {
        const d = greatCircleMeters(s.coord, asset, bodyRadiusMeters)
        const inside = d <= radiusMeters
        if (inside) {
            if (run == null) run = { startMs: s.t, endMs: s.t, closestMeters: d }
            else {
                run.endMs = s.t
                run.closestMeters = Math.min(run.closestMeters, d)
            }
        } else if (run != null) {
            if (run.endMs >= fromMs) return run
            run = null
        }
    }
    return run != null && run.endMs >= fromMs ? run : null
}

/** A synthetic circular-orbit ground track, for a layer with no service url. */
export function syntheticTrack(opts = {}) {
    const {
        startMs = Date.now(),
        durationSec = 6 * 3600,
        stepSec = 60,
        periodSec = 7000,
        inclinationDeg = 92,
        altitudeMeters = 400000,
        bodyRotationSec = 88642,
        name = 'Orbiter',
    } = opts
    const coordinates = []
    const times = []
    for (let t = 0; t <= durationSec; t += stepSec) {
        const u = (2 * Math.PI * t) / periodSec
        const lat = (Math.asin(Math.sin(inclinationDeg * DEG) * Math.sin(u)) / DEG)
        let lng =
            (Math.atan2(
                Math.cos(inclinationDeg * DEG) * Math.sin(u),
                Math.cos(u)
            ) /
                DEG) -
            (360 * t) / bodyRotationSec
        lng = ((((lng + 180) % 360) + 360) % 360) - 180
        coordinates.push([lng, lat])
        times.push(new Date(startMs + t * 1000).toISOString())
    }
    return {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates },
                properties: {
                    name,
                    times,
                    altitude_m: altitudeMeters,
                    start: times[0],
                    end: times[times.length - 1],
                },
            },
        ],
    }
}

/** Clip a track feature's samples to a time window, keeping properties. */
export function clipToWindow(feature, startMs, endMs, timesProp = 'times') {
    const samples = samplesOf(feature, timesProp)
    const kept = samples.filter((s) => s.t >= startMs && s.t <= endMs)
    if (kept.length < 2) return null
    return {
        ...feature,
        geometry: { type: 'LineString', coordinates: kept.map((s) => s.coord) },
        properties: {
            ...feature.properties,
            [timesProp]: kept.map((s) => new Date(s.t).toISOString()),
            start: new Date(kept[0].t).toISOString(),
            end: new Date(kept[kept.length - 1].t).toISOString(),
        },
    }
}
