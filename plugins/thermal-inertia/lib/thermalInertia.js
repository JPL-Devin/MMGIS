/**
 * Shared thermal-inertia math for the `thermal-inertia` container.
 *
 * This is the one fact all three plugins in this feature agree on — the
 * day/night → inertia model. It is a plain module with NO `src/essence` imports
 * (no `L_`, `F_`, jQuery, Leaflet), so the layer type, the attachment and the
 * interaction can all `import` it, and a Node unit test can too. See
 * plugins/README.md "One feature, several plugins".
 *
 * The model is a deliberately simple apparent-thermal-inertia proxy: a surface
 * with high thermal inertia stores heat and swings little between day and night,
 * so inertia is taken inversely proportional to the diurnal amplitude
 * (Td - Tn). Units are arbitrary; `scale` sets the working range.
 */

/**
 * The property names and constants a thermal-inertia layer knows and its
 * sibling plugins do not. The layer type declares these once in its manifest
 * (capabilities.defaultAttachments / defaultInteractions) and core hands them to
 * the attachment and interaction as their own `config`; both also fall back to
 * these so a bare `make({})` / `decide(f)` in a unit test does not throw.
 */
export const DEFAULTS = {
    dayTempProp: 'temp_day',
    nightTempProp: 'temp_night',
    scale: 1000,
    // Colour-ramp domain for the derived value (arbitrary inertia units).
    min: 0,
    max: 2000,
}

const numOr = (v, fallback) =>
    Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback

/**
 * Apparent thermal inertia from a day/night temperature pair.
 * @returns {number|null} null when the pair is missing or non-physical
 *   (amplitude <= 0 would mean night warmer than day).
 */
export function deriveInertia(dayTemp, nightTemp, opts = {}) {
    const scale = numOr(opts.scale, DEFAULTS.scale)
    const d = numOr(dayTemp, NaN)
    const n = numOr(nightTemp, NaN)
    if (!Number.isFinite(d) || !Number.isFinite(n)) return null
    const amplitude = d - n
    if (amplitude <= 0) return null
    return scale / amplitude
}

/**
 * Derive the full breakdown for one GeoJSON feature.
 * @returns {{dayTemp:number, nightTemp:number, amplitude:number,
 *   inertia:number}|null}
 */
export function inertiaOfFeature(feature, config = {}) {
    const dayProp = config.dayTempProp || DEFAULTS.dayTempProp
    const nightProp = config.nightTempProp || DEFAULTS.nightTempProp
    const props = (feature && feature.properties) || {}
    const dayTemp = numOr(props[dayProp], NaN)
    const nightTemp = numOr(props[nightProp], NaN)
    const inertia = deriveInertia(dayTemp, nightTemp, config)
    if (inertia == null) return null
    return { dayTemp, nightTemp, amplitude: dayTemp - nightTemp, inertia }
}

/**
 * A blue → red ramp over [min, max] for a derived inertia value.
 * Low inertia (big swing) is warm/red, high inertia is cool/blue.
 * @returns {string} an `#rrggbb` colour
 */
export function colorForInertia(inertia, config = {}) {
    const min = numOr(config.min, DEFAULTS.min)
    const max = numOr(config.max, DEFAULTS.max)
    if (!Number.isFinite(inertia)) return '#888888'
    const span = max - min || 1
    let t = (inertia - min) / span
    t = Math.max(0, Math.min(1, t))
    // t=0 (low inertia) → red (#d7191c); t=1 (high inertia) → blue (#2c7bb6)
    const lerp = (a, b) => Math.round(a + (b - a) * t)
    const r = lerp(0xd7, 0x2c)
    const g = lerp(0x19, 0x7b)
    const b = lerp(0x1c, 0xb6)
    const hex = (x) => x.toString(16).padStart(2, '0')
    return `#${hex(r)}${hex(g)}${hex(b)}`
}
