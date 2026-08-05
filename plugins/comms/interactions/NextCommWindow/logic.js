/**
 * NextCommWindow's decisions, with nothing imported from `src/essence`.
 * The handler beside it imports L_/TimeControl and so cannot be imported in a
 * Node unit test; this is what `tests/` covers.
 */
import { footprintRadiusMeters, nextWindow } from '../../shared/comms'

const num = (v, d) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : d)

/**
 * Which asset was clicked over: the nearest point feature of the asset layer.
 * @param {Array} assets [lng, lat] of each asset, with a name
 */
export function nearestAsset(assets, latlng) {
    if (!Array.isArray(assets) || assets.length === 0 || !latlng) return null
    let best = null
    for (const a of assets) {
        const d =
            (a.coord[0] - latlng.lng) ** 2 + (a.coord[1] - latlng.lat) ** 2
        if (best == null || d < best.d) best = { ...a, d }
    }
    return best
}

/**
 * The next window over `asset` on the clicked track feature.
 *
 * @param {object|null} feature   the clicked ground-track feature
 * @param {object|null} config    this interaction's settings
 * @param {object|null} asset     `{ name, coord: [lng, lat] }`
 * @param {object} env            `{ nowMs, altitudeMeters }` — facts the
 *                                handler read off the layers
 * @returns {{assetName:string, startMs:number, endMs:number,
 *            durationSec:number, radiusMeters:number}|null}
 */
export function decide(feature, config, asset, env = {}) {
    if (feature == null || asset == null) return null
    const timesProp = config?.timesProp || 'times'
    const elevationMaskDeg = num(config?.elevationMaskDeg, 10)
    const bodyRadiusMeters = num(config?.bodyRadiusMeters, 3396190)
    const altitudeMeters = num(
        env.altitudeMeters ?? feature.properties?.altitude_m,
        400000
    )
    const radiusMeters = footprintRadiusMeters(
        altitudeMeters,
        elevationMaskDeg,
        bodyRadiusMeters
    )
    const w = nextWindow(
        feature,
        asset.coord,
        radiusMeters,
        num(env.nowMs, Date.now()),
        { timesProp, bodyRadiusMeters }
    )
    if (w == null) return null
    return {
        assetName: asset.name,
        startMs: w.startMs,
        endMs: w.endMs,
        durationSec: Math.round((w.endMs - w.startMs) / 1000),
        radiusMeters: Math.round(radiusMeters),
    }
}
