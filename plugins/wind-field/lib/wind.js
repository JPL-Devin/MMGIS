/**
 * Shared wind maths for the wind-field container. Imported relatively by the
 * layer type, the attachment and the interaction — no `src/essence` imports, so
 * it is importable in a Node unit test.
 */

const DEG = Math.PI / 180

export const num = (v, fallback) =>
    Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback

/** Beaufort-ish bucket, used for both colour and the click report. */
export function speedCategory(speedMs) {
    const s = num(speedMs, 0)
    if (s < 2) return 'calm'
    if (s < 6) return 'light'
    if (s < 12) return 'moderate'
    if (s < 20) return 'strong'
    return 'gale'
}

export const CATEGORY_COLORS = {
    calm: '#2c7bb6',
    light: '#abd9e9',
    moderate: '#ffffbf',
    strong: '#fdae61',
    gale: '#d7191c',
}

/** Compass name of a meteorological direction (degrees the wind blows *from*). */
export function compass(directionDeg) {
    const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    const d = ((num(directionDeg, 0) % 360) + 360) % 360
    return names[Math.round(d / 45) % 8]
}

/**
 * The barb as a lat/lng polyline: a shaft pointing downwind plus two flights.
 * Length scales with speed, in degrees of latitude, which is enough for a
 * decoration and keeps this function pure.
 */
export function barbLine(lat, lng, speedMs, directionDeg, scale = 200) {
    const length = ((num(speedMs, 0) + 1) * num(scale, 200)) / 100000
    const towards = (num(directionDeg, 0) + 180) * DEG
    const dLat = Math.cos(towards) * length
    const dLng = Math.sin(towards) * length
    const tip = [lat + dLat, lng + dLng]
    const flight = (spread) => [
        tip[0] - Math.cos(towards + spread) * length * 0.3,
        tip[1] - Math.sin(towards + spread) * length * 0.3,
    ]
    return [
        [[lat, lng], tip],
        [flight(0.5), tip, flight(-0.5)],
    ]
}

/** What a click on a wind observation should say. */
export function report(feature, { speedProp = 'speed', directionProp = 'direction' } = {}) {
    if (feature == null) return null
    const p = feature.properties || {}
    if (p[speedProp] == null && p[directionProp] == null) return null
    const speed = num(p[speedProp], 0)
    return {
        speed,
        direction: num(p[directionProp], 0),
        category: speedCategory(speed),
        text: `${speed.toFixed(1)} m/s from ${compass(p[directionProp])} (${speedCategory(speed)})`,
    }
}
