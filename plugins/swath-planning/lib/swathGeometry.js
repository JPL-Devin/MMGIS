/**
 * Geometry shared by the three swath-planning plugins. Imports nothing from
 * `src/essence`, so it is the part that unit tests can reach.
 */

/** Bounding box of a GeoJSON feature: [minx, miny, maxx, maxy]. */
export function bboxOfFeature(feature) {
    const out = [Infinity, Infinity, -Infinity, -Infinity]
    const walk = (c) => {
        if (typeof c[0] === 'number') {
            out[0] = Math.min(out[0], c[0])
            out[1] = Math.min(out[1], c[1])
            out[2] = Math.max(out[2], c[0])
            out[3] = Math.max(out[3], c[1])
        } else c.forEach(walk)
    }
    const coords = feature?.geometry?.coordinates
    if (!coords) return null
    walk(coords)
    return out
}

/** Centre of a feature's bbox, as [lng, lat]. */
export function centroidOf(feature) {
    const b = bboxOfFeature(feature)
    return b ? [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2] : null
}

const overlaps = (a, b) =>
    a && b && a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3]

/** How many other features each feature's footprint overlaps. */
export function conflictCountsFor(features) {
    const boxes = features.map(bboxOfFeature)
    return boxes.map((box, i) =>
        boxes.reduce((n, other, j) => (j !== i && overlaps(box, other) ? n + 1 : n), 0)
    )
}

/**
 * The other swaths whose footprint overlaps `feature`'s.
 * @returns {{id: string, overlapDeg2: number, rollDeg: number|null}[]}
 */
export function conflictsWith(feature, others, props = {}) {
    const { idProp = 'swath_id', rollProp = 'roll_deg' } = props
    const box = bboxOfFeature(feature)
    if (!box) return []
    return others
        .filter((o) => o !== feature)
        .map((o) => ({ o, b: bboxOfFeature(o) }))
        .filter(({ b }) => overlaps(box, b))
        .map(({ o, b }) => ({
            id: o?.properties?.[idProp] ?? 'unknown',
            rollDeg: o?.properties?.[rollProp] ?? null,
            overlapDeg2:
                Math.max(0, Math.min(box[2], b[2]) - Math.max(box[0], b[0])) *
                Math.max(0, Math.min(box[3], b[3]) - Math.max(box[1], b[1])),
        }))
        .sort((a, b) => b.overlapDeg2 - a.overlapDeg2)
}

/**
 * End point of a look-direction arrow from a swath's centre.
 * @param {number[]} centre [lng, lat]
 * @param {number} azimuthDeg clockwise from north
 * @param {number} lengthDeg arrow length in degrees of latitude
 * @param {string} side 'left' or 'right' of track
 */
export function lookVector(centre, azimuthDeg, lengthDeg, side = 'right') {
    const bearing = (Number(azimuthDeg) || 0) + (side === 'left' ? -90 : 90)
    const r = (bearing * Math.PI) / 180
    const latScale = Math.max(0.05, Math.cos((centre[1] * Math.PI) / 180))
    return [centre[0] + (Math.sin(r) * lengthDeg) / latScale, centre[1] + Math.cos(r) * lengthDeg]
}
