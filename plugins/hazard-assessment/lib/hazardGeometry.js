/**
 * Shared, dependency-free geometry for the hazard-assessment feature.
 *
 * Imported relatively by all three plugins in this container (layertype,
 * layerattachment, interaction) as plugins/README.md prescribes, so it must not
 * import anything from `src/essence`.
 *
 * A hazard's keep-out buffer is modelled as a circle: the smallest circle
 * around the hazard polygon's own vertices, grown by a distance that scales
 * with the hazard's severity and its hazard class.
 */

/** Metres per degree of latitude at the equator, Mars-ish sphere-agnostic. */
const METERS_PER_DEGREE = 111320

/** Base keep-out distance in metres, per hazard class, at severity 1. */
export const CLASS_BASE_METERS = {
    slope: 150,
    rock_abundance: 80,
    crater_rim: 300,
}

/** Fallback base for an unrecognized hazard class. */
export const DEFAULT_BASE_METERS = 100

export const num = (v, fallback) =>
    Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback

/**
 * Facts about where a hazard feature keeps its severity and class. The layer
 * type owns these names and declares them to the attachment through
 * `capabilities.defaultAttachments`; both sides default them here so a partial
 * config still works.
 */
export const propsOf = (config) => ({
    severityProp: config?.severityProp || 'severity',
    classProp: config?.classProp || 'hazard_class',
    severityScale: num(config?.severityScale, 1),
})

/**
 * The keep-out distance, in metres, for one hazard feature.
 * @returns {number}
 */
export function bufferMetersFor(feature, config) {
    const { severityProp, classProp, severityScale } = propsOf(config)
    const severity = Math.max(0, num(feature?.properties?.[severityProp], 0))
    const hazardClass = feature?.properties?.[classProp]
    const base = num(
        config?.classBaseMeters?.[hazardClass],
        num(CLASS_BASE_METERS[hazardClass], DEFAULT_BASE_METERS)
    )
    return base * severity * severityScale
}

const coordsOf = (geometry) => {
    if (!geometry) return []
    const out = []
    const walk = (c) => {
        if (typeof c?.[0] === 'number') out.push(c)
        else if (Array.isArray(c)) c.forEach(walk)
    }
    walk(geometry.coordinates)
    return out
}

/** Planar metre distance between two [lng, lat] pairs — fine at hazard scale. */
export function metersBetween(a, b) {
    const latScale = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180)
    const dx = (b[0] - a[0]) * METERS_PER_DEGREE * latScale
    const dy = (b[1] - a[1]) * METERS_PER_DEGREE
    return Math.sqrt(dx * dx + dy * dy)
}

/**
 * The circular keep-out buffer of one hazard feature.
 * @returns {{center: number[], radiusMeters: number, hazardRadiusMeters: number,
 *   bufferMeters: number, severity: number, hazardClass: *, id: *}|null}
 */
export function bufferOf(feature, config) {
    const coords = coordsOf(feature?.geometry)
    if (coords.length === 0) return null

    const center = [
        coords.reduce((s, c) => s + c[0], 0) / coords.length,
        coords.reduce((s, c) => s + c[1], 0) / coords.length,
    ]
    const hazardRadiusMeters = coords.reduce(
        (max, c) => Math.max(max, metersBetween(center, c)),
        0
    )
    const bufferMeters = bufferMetersFor(feature, config)
    const { severityProp, classProp } = propsOf(config)

    return {
        center,
        hazardRadiusMeters,
        bufferMeters,
        radiusMeters: hazardRadiusMeters + bufferMeters,
        severity: num(feature?.properties?.[severityProp], 0),
        hazardClass: feature?.properties?.[classProp] ?? null,
        id: feature?.properties?.id ?? feature?.id ?? null,
    }
}

/** Every drawable buffer of a FeatureCollection. */
export const buffersOf = (geojson, config) =>
    (geojson?.features || [])
        .map((f) => bufferOf(f, config))
        .filter((b) => b != null && b.radiusMeters > 0)

/**
 * Which hazards' buffers a candidate landing point falls inside, and how far it
 * is from the nearest buffer edge.
 *
 * @param {number[]} point  [lng, lat] of the candidate landing site.
 * @param {Array} buffers   Buffers as produced by `buffersOf`, each tagged with
 *   the layer it came from by the caller.
 * @returns {{inside: Array, nearest: Object|null, safe: boolean}}
 */
export function assess(point, buffers) {
    if (!Array.isArray(point) || point.length < 2)
        return { inside: [], nearest: null, safe: true }

    const measured = (buffers || [])
        .filter(Boolean)
        .map((b) => {
            const distance = metersBetween(point, b.center)
            return {
                ...b,
                distanceToCenterMeters: distance,
                // Positive outside the buffer, negative inside it.
                distanceToEdgeMeters: distance - b.radiusMeters,
            }
        })
        .sort(
            (a, b) =>
                Math.abs(a.distanceToEdgeMeters) -
                Math.abs(b.distanceToEdgeMeters)
        )

    const inside = measured.filter((b) => b.distanceToEdgeMeters <= 0)
    return {
        inside,
        nearest: measured[0] || null,
        safe: inside.length === 0,
    }
}
