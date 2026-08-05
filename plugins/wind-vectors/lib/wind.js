/**
 * Shared wind maths and property resolution for the wind-vectors container.
 *
 * Imports nothing from `src/essence`, so all three plugins can use it and it is
 * unit testable in Node.
 */

export const DEFAULTS = {
    speedProp: 'wind_speed',
    directionProp: 'wind_direction',
    stationIdProp: 'station_id',
    gustProp: 'wind_gust',
}

/**
 * Read the property names an admin picked, falling back to the container-wide
 * defaults. Values cleared in Configure arrive as `''`, not `undefined`.
 *
 * @param {object|null} config
 * @returns {{speedProp: string, directionProp: string, stationIdProp: string, gustProp: string}}
 */
export function resolveProps(config) {
    const c = config || {}
    const pick = (v, d) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : d)
    return {
        speedProp: pick(c.speedProp, DEFAULTS.speedProp),
        directionProp: pick(c.directionProp, DEFAULTS.directionProp),
        stationIdProp: pick(c.stationIdProp, DEFAULTS.stationIdProp),
        gustProp: pick(c.gustProp, DEFAULTS.gustProp),
    }
}

/**
 * A station's wind, read off a feature with the configured property names.
 *
 * @param {object|null} feature GeoJSON feature
 * @param {object|null} config  plugin settings subtree
 * @returns {{speed: number, direction: number, station: string|null, gust: number|null}|null}
 */
export function windOf(feature, config) {
    if (feature == null) return null
    const props = feature.properties || {}
    const { speedProp, directionProp, stationIdProp, gustProp } = resolveProps(config)
    const speed = parseFloat(props[speedProp])
    const direction = parseFloat(props[directionProp])
    if (!isFinite(speed) || !isFinite(direction)) return null
    const gust = parseFloat(props[gustProp])
    return {
        speed,
        direction: ((direction % 360) + 360) % 360,
        station: props[stationIdProp] != null ? String(props[stationIdProp]) : null,
        gust: isFinite(gust) ? gust : null,
    }
}

const TO_KNOTS = {
    knots: 1,
    'm/s': 1.94384,
    'km/h': 0.539957,
    mph: 0.868976,
}

/**
 * @param {number} speed
 * @param {string} units one of `knots`, `m/s`, `km/h`, `mph`
 * @returns {number} speed in knots (NaN in, NaN out)
 */
export function toKnots(speed, units) {
    return speed * (TO_KNOTS[units] ?? 1)
}

/**
 * Standard meteorological barb decomposition of a speed in knots.
 *
 * @param {number} speedKnots
 * @returns {{pennants: number, fullBarbs: number, halfBarbs: number}}
 */
export function barbCounts(speedKnots) {
    let remaining = Math.max(0, Math.round(speedKnots / 5) * 5)
    const pennants = Math.floor(remaining / 50)
    remaining -= pennants * 50
    const fullBarbs = Math.floor(remaining / 10)
    remaining -= fullBarbs * 10
    const halfBarbs = Math.floor(remaining / 5)
    return { pennants, fullBarbs, halfBarbs }
}

/**
 * Is this gust worth reporting?
 *
 * @param {object|null} feature
 * @param {object|null} config
 * @returns {{station: string|null, gust: number, speed: number}|null}
 */
export function gustReport(feature, config) {
    if (feature == null) return null
    // A gust needs no direction, so this does not go through `windOf`.
    const props = feature.properties || {}
    const { speedProp, stationIdProp, gustProp } = resolveProps(config)
    const gust = parseFloat(props[gustProp])
    if (!isFinite(gust)) return null
    const threshold = parseFloat(config?.gustThreshold)
    if (isFinite(threshold) && gust < threshold) return null
    const speed = parseFloat(props[speedProp])
    return {
        station: props[stationIdProp] != null ? String(props[stationIdProp]) : null,
        gust,
        speed: isFinite(speed) ? speed : null,
    }
}
