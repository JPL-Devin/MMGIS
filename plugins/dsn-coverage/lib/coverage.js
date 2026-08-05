/**
 * Shared ground-station coverage math for the dsn-coverage container.
 *
 * Imported relatively by the layer type, the attachment and the interaction —
 * it is the only thing the three of them share, and the only part of the
 * feature that is unit testable, so it imports nothing from `src/essence`.
 */

const EARTH_RADIUS_M = 6371008.8
const DEG = Math.PI / 180

export const num = (v, fallback) =>
    Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback

/**
 * The properties a ground-station feature carries, and the defaults used when a
 * station omits one. The property *names* are the layer type's business — it
 * declares them to the attachment through `capabilities.defaultAttachments` —
 * so everything here takes them as settings rather than hardcoding them.
 */
export const DEFAULT_PROPS = {
    diameterProp: 'antenna_diameter_m',
    maskElevationProp: 'mask_elevation_deg',
    bandProp: 'band',
    nameProp: 'name',
}

export function stationOf(feature, props = {}) {
    const p = { ...DEFAULT_PROPS, ...props }
    const properties = feature?.properties || {}
    const coords = feature?.geometry?.coordinates || []
    return {
        name: String(properties[p.nameProp] ?? 'Station'),
        band: String(properties[p.bandProp] ?? ''),
        diameterM: num(properties[p.diameterProp], 34),
        maskElevationDeg: num(properties[p.maskElevationProp], 10),
        lng: num(coords[0], NaN),
        lat: num(coords[1], NaN),
    }
}

/**
 * Ground-track radius of the horizon mask: the surface distance out to where a
 * spacecraft at `altitudeKm` first clears the station's mask elevation. Bigger
 * dishes see a little further for the same mask, which is the `diameterM` term.
 *
 * @returns {number} metres
 */
export function maskRadiusMeters(station, settings = {}) {
    const scale = num(settings.scale, 1)
    const altitudeM = num(settings.altitudeKm, 700) * 1000
    const eps = num(station.maskElevationDeg, 10) * DEG
    const re = EARTH_RADIUS_M
    const ratio = (re * Math.cos(eps)) / (re + altitudeM)
    if (!(ratio >= -1 && ratio <= 1)) return 0
    const central = Math.acos(ratio) - eps
    const gain = 1 + (num(station.diameterM, 34) - 34) / 340
    return Math.max(0, re * central * gain * scale)
}

/** Great-circle distance in metres. */
export function distanceMeters(a, b) {
    const dLat = (b.lat - a.lat) * DEG
    const dLng = (b.lng - a.lng) * DEG
    const s =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLng / 2) ** 2
    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)))
}

/** A closed ring approximating a circle of `radiusM` about a station. */
export function circleRing(station, radiusM, steps = 64) {
    const ring = []
    const angular = radiusM / EARTH_RADIUS_M
    const lat1 = station.lat * DEG
    const lng1 = station.lng * DEG
    for (let i = 0; i <= steps; i++) {
        const brg = (i / steps) * 2 * Math.PI
        const lat2 = Math.asin(
            Math.sin(lat1) * Math.cos(angular) +
                Math.cos(lat1) * Math.sin(angular) * Math.cos(brg)
        )
        const lng2 =
            lng1 +
            Math.atan2(
                Math.sin(brg) * Math.sin(angular) * Math.cos(lat1),
                Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
            )
        ring.push([lng2 / DEG, lat2 / DEG])
    }
    return ring
}

/**
 * Which of `others` could hand a spacecraft over to `target`: their coverage
 * circles overlap, so a pass leaving one is already inside the other. When
 * `requireSameBand` is on, only stations sharing the target's band count.
 *
 * @returns {Array<{name, band, distanceKm, overlapKm}>} sorted by overlap
 */
export function handoverCandidates(target, others, settings = {}) {
    const rt = maskRadiusMeters(target, settings)
    return others
        .filter((s) => s && s.name !== target.name)
        .filter(
            (s) =>
                !settings.requireSameBand ||
                (s.band && target.band && s.band === target.band)
        )
        .map((s) => {
            const d = distanceMeters(target, s)
            const overlap = rt + maskRadiusMeters(s, settings) - d
            return {
                name: s.name,
                band: s.band,
                distanceKm: d / 1000,
                overlapKm: overlap / 1000,
            }
        })
        .filter((c) => c.overlapKm > 0)
        .sort((a, b) => b.overlapKm - a.overlapKm)
}
