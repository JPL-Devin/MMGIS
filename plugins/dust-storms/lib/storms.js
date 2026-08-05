/**
 * Shared, dependency-free storm maths for the dust-storms container.
 *
 * Imported relatively by the layer type, the attachment and the interaction —
 * the only thing the three families share, per plugins/README.md ("Code they all
 * need goes in a plain module anywhere in the container").
 */

/** The property names a dust-storm dataset uses, and their defaults. */
export const DEFAULT_PROPS = {
    idProp: 'storm_id',
    speedProp: 'speed_kmh',
    headingProp: 'heading_deg',
    intensityProp: 'intensity',
    timeProp: 'observed',
}

export const num = (v, fallback) =>
    Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback

/** A rough [lng, lat] centre of any geometry, from its coordinates alone. */
export function centroidOf(geometry) {
    if (geometry == null) return null
    const acc = { x: 0, y: 0, n: 0 }
    const walk = (c) => {
        if (!Array.isArray(c)) return
        if (typeof c[0] === 'number' && typeof c[1] === 'number') {
            acc.x += c[0]
            acc.y += c[1]
            acc.n++
            return
        }
        c.forEach(walk)
    }
    walk(geometry.coordinates)
    return acc.n === 0 ? null : [acc.x / acc.n, acc.y / acc.n]
}

/**
 * The motion vector of one storm observation, in degrees of lng/lat.
 *
 * @param {object} feature GeoJSON feature.
 * @param {object} props   { speedProp, headingProp, intensityProp }
 * @param {number} scale   km drawn per km/h of speed.
 * @returns {{from: number[], to: number[], intensity: number, speed: number,
 *   heading: number}|null} null when the feature carries no usable motion.
 */
export function motionVectorOf(feature, props = {}, scale = 1) {
    const p = { ...DEFAULT_PROPS, ...props }
    const properties = feature?.properties || {}
    const speed = num(properties[p.speedProp], NaN)
    const heading = num(properties[p.headingProp], NaN)
    if (!Number.isFinite(speed) || !Number.isFinite(heading)) return null

    const from = centroidOf(feature.geometry)
    if (from == null) return null

    // Intensity only scales the arrow's length, so a missing one is "1".
    const intensity = num(properties[p.intensityProp], 1)
    const km = speed * num(scale, 1) * intensity
    // ~111 km per degree of latitude; lng shrinks with the cosine of latitude.
    const rad = (heading * Math.PI) / 180
    const dLat = (km * Math.cos(rad)) / 111
    const cos = Math.cos((from[1] * Math.PI) / 180)
    const dLng = (km * Math.sin(rad)) / (111 * (Math.abs(cos) < 1e-6 ? 1e-6 : cos))

    return {
        from,
        to: [from[0] + dLng, from[1] + dLat],
        intensity,
        speed,
        heading,
    }
}

/** Every observation of one storm, oldest first. */
export function trackOf(features, stormId, props = {}) {
    const p = { ...DEFAULT_PROPS, ...props }
    return (features || [])
        .filter((f) => String(f?.properties?.[p.idProp]) === String(stormId))
        .sort(
            (a, b) =>
                Date.parse(a?.properties?.[p.timeProp]) -
                Date.parse(b?.properties?.[p.timeProp])
        )
}

/**
 * The same storm's next observation in a direction.
 *
 * @param {object[]} features All known observations.
 * @param {object} feature    The clicked one.
 * @param {number} step       +1 forwards in time, -1 backwards.
 * @param {object} props      property names
 * @returns {object|null} null at either end of the track.
 */
export function stepInTime(features, feature, step, props = {}) {
    const p = { ...DEFAULT_PROPS, ...props }
    const id = feature?.properties?.[p.idProp]
    if (id == null) return null
    const track = trackOf(features, id, p)
    const at = Date.parse(feature?.properties?.[p.timeProp])
    if (!Number.isFinite(at)) return null

    const later = track.filter((f) => Date.parse(f.properties[p.timeProp]) > at)
    const earlier = track.filter((f) => Date.parse(f.properties[p.timeProp]) < at)
    if (step >= 0) return later[0] || null
    return earlier[earlier.length - 1] || null
}

/** Features whose time window overlaps [start, end]; all of them if no window. */
export function inWindow(features, start, end, props = {}) {
    const p = { ...DEFAULT_PROPS, ...props }
    const s = Date.parse(start)
    const e = Date.parse(end)
    if (!Number.isFinite(s) || !Number.isFinite(e)) return features || []
    return (features || []).filter((f) => {
        const t = Date.parse(f?.properties?.[p.timeProp])
        return !Number.isFinite(t) || (t >= s && t <= e)
    })
}
