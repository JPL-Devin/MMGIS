/**
 * FOV Wedges attachment — draws an instrument field-of-view wedge at each point
 * feature of its host, oriented by an azimuth property and sized by a
 * half-angle and a range. Intended for rover traverse stops (which way the mast
 * camera was pointed, and how far it saw) and for science targets observed from
 * a standoff.
 *
 * Geometry is computed on a sphere of `bodyRadius` metres, so the wedge stays
 * correct at high latitude where a planar approximation shears. The radius is a
 * setting rather than read from the mission because this module is deliberately
 * dependency-free: importing an MMGIS singleton pulls jQuery in and makes the
 * module un-importable in a unit test.
 */

const leaflet = () => window.L

const DEG = Math.PI / 180

const num = (v, fallback) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback)

/** Dotted property lookup, so `azimuthProp` may be `pose.yaw`. */
const getIn = (obj, path, fallback) => {
    if (obj == null || !path) return fallback
    const value = String(path)
        .split('.')
        .reduce((o, k) => (o == null ? undefined : o[k]), obj)
    return value === undefined || value === null ? fallback : value
}

/**
 * Great-circle destination from [lng, lat] on a sphere of `radius` metres.
 * @returns {[number, number]} [lng, lat]
 */
const destination = (lng, lat, bearingDeg, distanceMeters, radius) => {
    const d = distanceMeters / radius
    const brg = bearingDeg * DEG
    const lat1 = lat * DEG
    const lng1 = lng * DEG
    const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg)
    )
    const lng2 =
        lng1 +
        Math.atan2(
            Math.sin(brg) * Math.sin(d) * Math.cos(lat1),
            Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
        )
    return [((lng2 / DEG + 540) % 360) - 180, lat2 / DEG]
}

/** The settings, defaulted — a host that was never configured hands us null. */
export const settingsOf = (config) => {
    const c = config || {}
    return {
        azimuthProp: c.azimuthProp || 'azimuth',
        azimuthUnit: c.azimuthUnit === 'rad' ? 'rad' : 'deg',
        azimuthOffset: num(c.azimuthOffset, 0),
        fovProp: c.fovProp || null,
        fovDegrees: num(c.fovDegrees, 60),
        rangeProp: c.rangeProp || null,
        rangeMeters: num(c.rangeMeters, 25),
        bodyRadius: num(c.bodyRadius, 3396190),
        segments: Math.max(2, Math.round(num(c.segments, 24))),
        color: c.color || '#ffcc00',
        fillOpacity: num(c.fillOpacity, 0.2),
        weight: num(c.weight, 1),
        opacity: num(c.opacity, 0.9),
    }
}

/**
 * The wedge ring for one point: apex → arc of `fov` degrees centred on the
 * azimuth → back to the apex. A `fov` of 360 becomes a full circle (no apex
 * spokes), which is what an omnidirectional instrument wants.
 */
export const wedgeRing = (lng, lat, azimuth, fov, range, s) => {
    const clamped = Math.min(360, Math.max(0, fov))
    const half = clamped / 2
    const ring = []
    if (clamped < 360) ring.push([lng, lat])
    for (let i = 0; i <= s.segments; i++) {
        const bearing = azimuth - half + (clamped * i) / s.segments
        ring.push(destination(lng, lat, bearing, range, s.bodyRadius))
    }
    ring.push(clamped < 360 ? [lng, lat] : ring[0])
    return ring
}

/** GeoJSON polygons derived from the host's point features. */
export const wedgesOf = (geojson, s) => {
    const features = []
    for (const f of geojson?.features || []) {
        if (f?.geometry?.type !== 'Point') continue
        const raw = getIn(f.properties, s.azimuthProp, null)
        if (raw === null || !Number.isFinite(parseFloat(raw))) continue
        let azimuth = parseFloat(raw)
        if (s.azimuthUnit === 'rad') azimuth /= DEG
        azimuth += s.azimuthOffset

        const fov = s.fovProp
            ? num(getIn(f.properties, s.fovProp, s.fovDegrees), s.fovDegrees)
            : s.fovDegrees
        const range = s.rangeProp
            ? num(getIn(f.properties, s.rangeProp, s.rangeMeters), s.rangeMeters)
            : s.rangeMeters
        if (!(range > 0)) continue

        const [lng, lat] = f.geometry.coordinates
        features.push({
            type: 'Feature',
            properties: {
                ...(f.properties || {}),
                _fovAzimuth: azimuth,
                _fovDegrees: fov,
                _fovRangeMeters: range,
            },
            geometry: {
                type: 'Polygon',
                coordinates: [wedgeRing(lng, lat, azimuth, fov, range, s)],
            },
        })
    }
    return { type: 'FeatureCollection', features }
}

const buildLayer = (geojson, s) =>
    leaflet().geoJson(wedgesOf(geojson, s), {
        style: {
            color: s.color,
            fillColor: s.color,
            fillOpacity: s.fillOpacity,
            weight: s.weight,
            opacity: s.opacity,
            className: 'noPointerEventsImportant',
        },
    })

function make({ geojson, config }) {
    const s = settingsOf(config)
    return {
        on: config?.initialVisibility !== false,
        type: 'fov_wedges',
        geojson,
        layer: buildLayer(geojson, s),
        // syncData and onConfigChange are handed new data / new settings, never
        // both, so each needs whichever it wasn't given.
        _settings: s,
    }
}

/**
 * The host's data changed. Core's default re-adds the host's GeoJSON, which
 * would draw the host's own points; these are derived polygons, so rebuild.
 */
function syncData(attachment, { geojson, onlyClear }) {
    attachment.layer.clearLayers()
    if (onlyClear) return
    attachment.geojson = geojson
    attachment.layer.addData(wedgesOf(geojson, attachment._settings))
}

/**
 * Settings changed. Retune in place — core's default rebuilds the whole host
 * layer, which for a pointing change is a lot of work for new polygons.
 */
function onConfigChange({ attachment, config }) {
    if (!attachment) return
    const s = settingsOf(config)
    attachment._settings = s
    attachment.layer.clearLayers()
    attachment.layer.addData(wedgesOf(attachment.geojson, s))
    attachment.layer.setStyle({
        color: s.color,
        fillColor: s.color,
        fillOpacity: s.fillOpacity,
        weight: s.weight,
        opacity: s.opacity,
    })
}

export default { make, syncData, onConfigChange }
