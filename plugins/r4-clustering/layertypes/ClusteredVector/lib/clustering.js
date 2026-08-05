/**
 * Grid clustering / decimation for a dense point layer.
 *
 * Pure functions, no MMGIS singletons and no Leaflet, so this file is importable
 * in a Node unit test.
 *
 * The property names below are the contract the ClusterCounts attachment and the
 * ClusterExpand interaction read. There is no cross-plugin import path in the
 * plugin system, so they are documented here and repeated there.
 */

// Written onto every emitted feature.
export const CLUSTER_PROPS = {
    count: '_clusterCount', // number of source features represented
    bounds: '_clusterBounds', // [minLng, minLat, maxLng, maxLat]
    members: '_clusterMembers', // the source features, when kept
    isCluster: '_isCluster', // true when count > 1
}

const num = (v, fallback) =>
    Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback

/** Degrees per grid cell at a zoom level: coarse when far out, fine when in. */
export function cellSizeForZoom(zoom, cellsPerTile = 2) {
    const z = Number.isFinite(zoom) ? Math.max(0, zoom) : 0
    return 360 / (Math.pow(2, z) * 32 * cellsPerTile)
}

const pointsOf = (geojson) =>
    (geojson?.features || []).filter(
        (f) => f?.geometry?.type === 'Point' && f.geometry.coordinates?.length >= 2
    )

/** Keep every nth feature so the map draws a readable sample of the whole set. */
export function decimate(geojson, maxPoints) {
    const features = geojson?.features || []
    const max = Math.max(1, num(maxPoints, 5000))
    if (features.length <= max) return { type: 'FeatureCollection', features }
    const step = Math.ceil(features.length / max)
    return {
        type: 'FeatureCollection',
        features: features.filter((_, i) => i % step === 0),
    }
}

/**
 * Aggregate point features into one feature per grid cell.
 *
 * A cell holding a single feature is passed through unchanged apart from the
 * cluster properties, so a fully zoomed-in layer looks like its source data.
 */
export function cluster(geojson, zoom, options = {}) {
    const { cellsPerTile = 2, keepMembers = true, maxMembers = 500 } = options
    const size = cellSizeForZoom(zoom, cellsPerTile)
    const cells = new Map()

    for (const f of pointsOf(geojson)) {
        const [lng, lat] = f.geometry.coordinates
        const key = `${Math.floor(lng / size)}|${Math.floor(lat / size)}`
        const cell = cells.get(key)
        if (cell) {
            cell.features.push(f)
            cell.sumLng += lng
            cell.sumLat += lat
            cell.bounds[0] = Math.min(cell.bounds[0], lng)
            cell.bounds[1] = Math.min(cell.bounds[1], lat)
            cell.bounds[2] = Math.max(cell.bounds[2], lng)
            cell.bounds[3] = Math.max(cell.bounds[3], lat)
        } else {
            cells.set(key, {
                features: [f],
                sumLng: lng,
                sumLat: lat,
                bounds: [lng, lat, lng, lat],
            })
        }
    }

    let maxCount = 0
    const features = []
    for (const cell of cells.values()) {
        const count = cell.features.length
        maxCount = Math.max(maxCount, count)
        const base = count === 1 ? cell.features[0].properties || {} : {}
        features.push({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates:
                    count === 1
                        ? cell.features[0].geometry.coordinates
                        : [cell.sumLng / count, cell.sumLat / count],
            },
            properties: {
                ...base,
                [CLUSTER_PROPS.count]: count,
                [CLUSTER_PROPS.isCluster]: count > 1,
                [CLUSTER_PROPS.bounds]: cell.bounds,
                ...(keepMembers && count > 1 && count <= maxMembers
                    ? { [CLUSTER_PROPS.members]: cell.features }
                    : {}),
            },
        })
    }

    return {
        geojson: { type: 'FeatureCollection', features },
        stats: {
            sourceCount: pointsOf(geojson).length,
            clusterCount: features.length,
            maxCount,
            zoom,
            cellSize: size,
        },
    }
}

/** Even count bins over [1, maxCount] with a colour per bin. */
export function bins(maxCount, colors) {
    const ramp =
        Array.isArray(colors) && colors.length
            ? colors
            : ['#ffffb2', '#fecc5c', '#fd8d3c', '#f03b20', '#bd0026']
    const max = Math.max(1, num(maxCount, 1))
    if (max === 1) return [{ min: 1, max: 1, color: ramp[ramp.length - 1] }]
    const step = Math.ceil(max / ramp.length)
    const out = []
    for (let i = 0; i < ramp.length; i++) {
        const min = i * step + 1
        if (min > max) break
        out.push({ min, max: Math.min(max, (i + 1) * step), color: ramp[i] })
    }
    return out
}

export function colorForCount(count, binList) {
    for (const b of binList) if (count >= b.min && count <= b.max) return b.color
    return binList[binList.length - 1]?.color
}
