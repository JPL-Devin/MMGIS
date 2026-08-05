/**
 * ClusteredVector — the `source` surface.
 *
 * Core fetches the layer's url once, then this surface returns a *clustered or
 * decimated* FeatureCollection for the current zoom. Re-clustering rides on
 * core's dynamic-extent refetch (`variables.dynamicExtent`, defaulted in
 * config.js), which is the only hook a layer type has onto "the view moved".
 */
import { cluster, decimate, bins, colorForCount, CLUSTER_PROPS } from './lib/clustering'

// layerName -> the un-clustered source data, so a zoom change is not a refetch.
const rawCache = new Map()

const num = (v, fallback) =>
    Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback

const normalizeGeojson = (data) => {
    if (!data) return null
    if (Array.isArray(data)) return { type: 'FeatureCollection', features: data }
    if (Array.isArray(data.features)) return data
    if (Array.isArray(data.Features))
        return { type: 'FeatureCollection', features: data.Features }
    return null
}

const currentZoom = (ctx) =>
    Number.isFinite(ctx?.view?.zoom)
        ? ctx.view.zoom
        : window.Map_?.map?.getZoom?.() ?? 0

async function loadRaw(url) {
    const res = await window.fetch(url)
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
    return normalizeGeojson(await res.json())
}

async function fetch(layerObj, ctx = {}) {
    const cfg = layerObj.variables?.clustering || {}
    if (cfg.enabled === false) return null

    let raw = rawCache.get(layerObj.name)
    if (!raw || ctx.trigger === 'make') {
        if (!ctx.url) return null
        raw = await loadRaw(ctx.url)
        rawCache.set(layerObj.name, raw)
    }
    if (!raw) return null

    const zoom = currentZoom(ctx)
    const passthroughZoom = num(cfg.passthroughZoom, 14)

    if (zoom >= passthroughZoom) {
        const out = decimate(raw, num(cfg.maxPoints, 20000))
        layerObj._clusterStats = {
            sourceCount: raw.features?.length || 0,
            clusterCount: out.features.length,
            maxCount: 1,
            zoom,
            mode: 'points',
        }
        return out
    }

    if ((cfg.mode || 'cluster') === 'decimate') {
        const out = decimate(raw, num(cfg.maxPoints, 5000))
        layerObj._clusterStats = {
            sourceCount: raw.features?.length || 0,
            clusterCount: out.features.length,
            maxCount: 1,
            zoom,
            mode: 'decimate',
        }
        return out
    }

    const { geojson, stats } = cluster(raw, zoom, {
        cellsPerTile: num(cfg.cellsPerTile, 2),
        keepMembers: cfg.keepMembers !== false,
        maxMembers: num(cfg.maxMembers, 500),
    })

    // Style from the data: a per-feature style is the only styling that wins
    // over the mission's configured style, and it is what makes the derived
    // legend and the drawn clusters agree.
    const binList = bins(stats.maxCount, cfg.colors)
    for (const f of geojson.features) {
        const count = f.properties[CLUSTER_PROPS.count]
        const color = colorForCount(count, binList)
        f.properties.style = {
            color,
            fillColor: color,
            fillOpacity: 0.85,
            weight: 1,
            radius: count > 1 ? Math.min(24, 6 + Math.log2(count) * 4) : 5,
        }
    }

    layerObj._clusterStats = { ...stats, mode: 'cluster' }
    layerObj._clusterBins = binList
    return geojson
}

export default { fetch }
