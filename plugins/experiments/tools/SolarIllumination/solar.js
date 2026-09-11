// Low-precision solar position approximations for Earth and Mars.
// Earth: NOAA solar calculator equations. Mars: Allison & McEwen (2000) / Mars24.

const D2R = Math.PI / 180
const R2D = 180 / Math.PI

export const BODIES = {
    EARTH: { name: 'Earth', dayHours: 24 },
    MARS: { name: 'Mars', dayHours: 24.6597 },
}

// Guess body from mission radius (m); falls back to Earth.
export function bodyFromRadius(radiusMajor) {
    const r = parseFloat(radiusMajor)
    if (!isNaN(r) && Math.abs(r - 3396190) < 50000) return 'MARS'
    return 'EARTH'
}

function toJD(date) {
    return date.getTime() / 86400000 + 2440587.5
}

function norm360(x) {
    return ((x % 360) + 360) % 360
}

function altAz(decl, lat, hourAngle) {
    const latR = lat * D2R
    const decR = decl * D2R
    const haR = hourAngle * D2R
    const sinEl =
        Math.sin(latR) * Math.sin(decR) +
        Math.cos(latR) * Math.cos(decR) * Math.cos(haR)
    const el = Math.asin(Math.max(-1, Math.min(1, sinEl)))
    const y = -Math.sin(haR) * Math.cos(decR)
    const x =
        Math.sin(decR) * Math.cos(latR) -
        Math.cos(decR) * Math.sin(latR) * Math.cos(haR)
    const az = norm360(Math.atan2(y, x) * R2D)
    return { elevation: el * R2D, azimuth: az }
}

function earthSun(date, lat, lon) {
    const jd = toJD(date)
    const t = (jd - 2451545.0) / 36525
    const L0 = norm360(280.46646 + t * (36000.76983 + 0.0003032 * t))
    const M = norm360(357.52911 + t * (35999.05029 - 0.0001537 * t))
    const Mr = M * D2R
    const C =
        Math.sin(Mr) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
        Math.sin(2 * Mr) * (0.019993 - 0.000101 * t) +
        Math.sin(3 * Mr) * 0.000289
    const trueLon = L0 + C
    const omega = 125.04 - 1934.136 * t
    const lambda = trueLon - 0.00569 - 0.00478 * Math.sin(omega * D2R)
    const eps0 =
        23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
    const eps = eps0 + 0.00256 * Math.cos(omega * D2R)
    const decl =
        Math.asin(Math.sin(eps * D2R) * Math.sin(lambda * D2R)) * R2D
    const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t)
    const yv = Math.tan((eps / 2) * D2R) ** 2
    const L0r = L0 * D2R
    const eot =
        4 *
        R2D *
        (yv * Math.sin(2 * L0r) -
            2 * e * Math.sin(Mr) +
            4 * e * yv * Math.sin(Mr) * Math.cos(2 * L0r) -
            0.5 * yv * yv * Math.sin(4 * L0r) -
            1.25 * e * e * Math.sin(2 * Mr)) // minutes
    const utcMinutes =
        date.getUTCHours() * 60 +
        date.getUTCMinutes() +
        date.getUTCSeconds() / 60
    const tst = (utcMinutes + eot + 4 * lon + 1440) % 1440
    const ha = tst / 4 - 180
    return {
        ...altAz(decl, lat, ha),
        declination: decl,
        localSolarTime: tst / 60,
        seasonAngle: norm360(lambda),
    }
}

function marsSun(date, lat, lonEast) {
    const jdUT = toJD(date)
    const jdTT = jdUT + (37 + 32.184) / 86400
    const dt = jdTT - 2451545.0
    const M = norm360(19.3871 + 0.52402073 * dt)
    const alphaFMS = norm360(270.3871 + 0.524038496 * dt)
    const Mr = M * D2R
    const pert = [
        [0.0071, 2.2353, 49.409],
        [0.0057, 2.7543, 168.173],
        [0.0039, 1.1177, 191.837],
        [0.0037, 15.7866, 21.736],
        [0.0021, 2.1354, 15.704],
        [0.002, 2.4694, 95.528],
        [0.0018, 32.8493, 49.095],
    ].reduce(
        (s, [A, tau, phi]) =>
            s + A * Math.cos(((0.985626 * dt) / tau + phi) * D2R),
        0
    )
    const nuMinusM =
        (10.691 + 3.0e-7 * dt) * Math.sin(Mr) +
        0.623 * Math.sin(2 * Mr) +
        0.05 * Math.sin(3 * Mr) +
        0.005 * Math.sin(4 * Mr) +
        0.0005 * Math.sin(5 * Mr) +
        pert
    const Ls = norm360(alphaFMS + nuMinusM)
    const LsR = Ls * D2R
    const decl =
        Math.asin(0.42565 * Math.sin(LsR)) * R2D + 0.25 * Math.sin(LsR)
    const eot =
        2.861 * Math.sin(2 * LsR) -
        0.071 * Math.sin(4 * LsR) +
        0.002 * Math.sin(6 * LsR) -
        nuMinusM // degrees
    const msd = (jdTT - 2451549.5) / 1.0274912517 + 44796.0 - 0.0009626
    const mtc = (24 * msd) % 24
    const lonWest = norm360(-lonEast)
    const lmst = (((mtc - lonWest / 15) % 24) + 24) % 24
    const ltst = (((lmst + eot / 15) % 24) + 24) % 24
    const ha = 15 * (ltst - 12)
    return {
        ...altAz(decl, lat, ha),
        declination: decl,
        localSolarTime: ltst,
        seasonAngle: Ls,
        marsSolDate: msd,
    }
}

export function solarPosition(body, date, lat, lon) {
    return body === 'MARS' ? marsSun(date, lat, lon) : earthSun(date, lat, lon)
}
