/**
 * Ring geometry/colour maths, duplicated deliberately from the Seismic layer
 * type's `lib/usgs.js`: an attachment is a separate plugin (potentially a
 * separate repo) and there is no supported way for one plugin to import another,
 * so shared derivation has to be copied.
 */

const num = (v, fallback) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback)

/** Ring radius in metres for a magnitude — area grows with released energy. */
export function ringRadiusMeters(magnitude, scale = 2000) {
    const m = num(magnitude, 0)
    if (m <= 0) return scale
    return scale * Math.pow(2, m)
}

/** Depth-banded colour, shallow (hot) → deep (cool). */
export function depthColor(depthKm) {
    const d = num(depthKm, 0)
    if (d < 10) return '#d7191c'
    if (d < 30) return '#fdae61'
    if (d < 70) return '#ffffbf'
    if (d < 300) return '#abd9e9'
    return '#2c7bb6'
}

export default { ringRadiusMeters, depthColor }
