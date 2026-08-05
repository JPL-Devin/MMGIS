/**
 * Pure ring geometry — imports nothing from src/essence so it can be unit
 * tested in Node (see tests/helpers/browser-globals.js).
 */

const DEFAULT_COLOR = '#4ad4ff'
const DEFAULT_RINGS = [{ radius: 100, color: DEFAULT_COLOR }]

const asNumber = (value, fallback) => {
    const parsed = parseFloat(value)
    return isNaN(parsed) ? fallback : parsed
}

/** A value at a dotted property path, without pulling in F_. */
const propertyAt = (properties, path) =>
    String(path)
        .split('.')
        .reduce((at, key) => (at == null ? undefined : at[key]), properties)

/** Rings, normalized and sorted outward. */
export const ringsOf = (config) => {
    const rings =
        Array.isArray(config?.rings) && config.rings.length
            ? config.rings
            : DEFAULT_RINGS
    return rings
        .map((ring) => ({
            radius: asNumber(ring.radius, 0),
            color: ring.color || DEFAULT_COLOR,
            fill: ring.fill === true,
            label: ring.label || '',
        }))
        .filter((ring) => ring.radius > 0)
        .sort((a, b) => a.radius - b.radius)
}

/**
 * The radius in metres this ring has about this feature. A `radiusProperty`
 * turns the configured radius into a multiplier of a per-feature value, so
 * `1, 2, 3` means 1x, 2x, 3x the feature's remaining drive range.
 */
export const radiusFor = (ring, feature, config) => {
    const scale = config?.radiusProperty
        ? asNumber(propertyAt(feature?.properties, config.radiusProperty), 0)
        : 1
    const radius = ring.radius * scale
    return config?.units === 'kilometers' ? radius * 1000 : radius
}

/**
 * A circle about a lng/lat as a GeoJSON polygon, on a body of the given radius.
 */
export const circle = ([lng, lat], meters, bodyRadius, steps = 64) => {
    const angular = meters / bodyRadius
    const latRad = (lat * Math.PI) / 180
    const coordinates = []
    for (let i = 0; i < steps; i++) {
        const theta = (i / steps) * 2 * Math.PI
        const dLat = (angular * Math.cos(theta) * 180) / Math.PI
        const cos = Math.max(Math.cos(latRad), 1e-6)
        const dLng = (angular * Math.sin(theta) * 180) / Math.PI / cos
        coordinates.push([lng + dLng, lat + dLat])
    }
    coordinates.push(coordinates[0])
    return coordinates
}

/** One polygon per ring per point feature. */
export const ringPolygons = (geojson, config, bodyRadius = 6378137) => {
    const rings = ringsOf(config)
    const features = []
    for (const f of geojson?.features || []) {
        if (f?.geometry?.type !== 'Point') continue
        rings.forEach((ring, index) => {
            const meters = radiusFor(ring, f, config)
            if (!(meters > 0)) return
            features.push({
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [
                        circle(f.geometry.coordinates, meters, bodyRadius),
                    ],
                },
                properties: {
                    ...(f.properties || {}),
                    _rangeRing: {
                        index,
                        radius: meters,
                        color: ring.color,
                        fill: ring.fill,
                        label: ring.label,
                    },
                },
            })
        })
    }
    return { type: 'FeatureCollection', features }
}

export const styleOf = (config) => (feature) => {
    const ring = feature?.properties?._rangeRing || {}
    return {
        color: ring.color,
        weight: asNumber(config?.weight, 1),
        opacity: asNumber(config?.opacity, 0.9),
        fillColor: ring.color,
        fillOpacity: ring.fill ? asNumber(config?.fillOpacity, 0.1) : 0,
        dashArray: config?.dashArray === '' ? null : config?.dashArray || '4 6',
        className: 'noPointerEventsImportant',
    }
}

export const labelFor = (feature, config) => {
    const ring = feature?.properties?._rangeRing || {}
    if (config?.showLabels === false) return null
    return ring.label || `${Math.round(ring.radius)} m`
}
