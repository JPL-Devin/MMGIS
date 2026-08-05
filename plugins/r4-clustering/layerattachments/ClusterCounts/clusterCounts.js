/**
 * ClusterCounts attachment — a count label on every cluster of its host.
 *
 * The host is a `clusteredvector` layer, whose features carry the cluster
 * properties its source surface wrote. There is no import path from one plugin
 * to another, so the property names are duplicated here rather than imported
 * from the layer type's lib/clustering.js.
 */

// Leaflet per call, not at import time, so this module imports in Node.
const leaflet = () => window.L

const COUNT_PROP = '_clusterCount'

const num = (v, fallback) =>
    Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback

const abbreviate = (n) =>
    n >= 1000000
        ? `${Math.round(n / 100000) / 10}M`
        : n >= 1000
          ? `${Math.round(n / 100) / 10}k`
          : `${n}`

/** One divIcon marker per cluster feature holding more than `minCount`. */
export function labelsOf(geojson, config = {}) {
    const L = leaflet()
    const minCount = num(config.minCount, 2)
    const color = config.color || '#000000'
    const size = num(config.fontSize, 11)

    return (geojson?.features || [])
        .filter((f) => {
            const count = num(f?.properties?.[COUNT_PROP], 0)
            return f?.geometry?.type === 'Point' && count >= minCount
        })
        .map((f) => {
            const [lng, lat] = f.geometry.coordinates
            const count = num(f.properties[COUNT_PROP], 0)
            const text = config.abbreviate === false ? `${count}` : abbreviate(count)
            return L.marker([lat, lng], {
                interactive: false,
                keyboard: false,
                icon: L.divIcon({
                    className: 'clusterCountsLabel',
                    html: `<span style="color:${color};font-size:${size}px;font-weight:700;text-shadow:0 0 3px #fff,0 0 3px #fff;white-space:nowrap">${text}</span>`,
                    iconSize: null,
                }),
            })
        })
}

function make({ geojson, config }) {
    return {
        on: config?.initialVisibility !== false,
        type: 'cluster_counts',
        geojson,
        layer: leaflet().layerGroup(labelsOf(geojson, config || {})),
        // syncData is handed new data but not the config, so keep it.
        _config: config || {},
    }
}

/**
 * The host re-clustered (every zoom, for a dynamic-extent layer). The core
 * default re-adds the host's GeoJSON, which would draw the host's own features;
 * these are derived markers, so they are rebuilt.
 */
function syncData(attachment, { geojson, onlyClear }) {
    attachment.layer.clearLayers()
    if (onlyClear) return
    attachment.geojson = geojson
    labelsOf(geojson, attachment._config).forEach((m) =>
        attachment.layer.addLayer(m)
    )
}

/** Retune the labels in place instead of paying for a whole host rebuild. */
function onConfigChange(ctx) {
    const attachment = ctx.attachment
    if (!attachment) return
    attachment._config = ctx.config || {}
    syncData(attachment, { geojson: attachment.geojson })
}

export default { make, syncData, onConfigChange }
