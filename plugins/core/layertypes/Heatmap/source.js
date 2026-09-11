// `source.fetch` — a heatmap has no url; it acquires the configured source
// layer's GeoJSON headlessly (works even when that layer is toggled off).
import L_ from '@basics/Layers_/Layers_'
import F_ from '@basics/Formulae_/Formulae_'

// Mirror core's local time filter (time.type 'local' + endProp) on acquired data.
export function applyLocalTimeWindow(sourceData, geojson) {
    const t = sourceData?.time
    if (!geojson?.features || t == null || t.enabled !== true) return geojson
    if (t.type !== 'local' || t.endProp == null) return geojson
    const start = t.start ? new Date(t.start).getTime() : 0
    const end = t.end ? new Date(t.end).getTime() : Infinity
    if (!Number.isFinite(start) && start !== 0) return geojson
    const features = geojson.features.filter((f) => {
        const endValue = F_.getIn(f.properties, t.endProp, false)
        if (endValue === false) return false
        const endDate = new Date(endValue).getTime()
        if (!Number.isFinite(endDate)) return false
        if (!t.startProp) return endDate <= end && endDate >= start
        const startDate = new Date(
            F_.getIn(f.properties, t.startProp, 0)
        ).getTime()
        if (!Number.isFinite(startDate)) return false
        return !(end < startDate || start > endDate)
    })
    return { ...geojson, features }
}

async function fetch(layerObj, ctx = {}) {
    const sourceName = layerObj.variables?.sourceLayer
    if (!sourceName) {
        console.warn(
            `Heatmap layer '${layerObj.name}' has no variables.sourceLayer.`
        )
        return F_.getBaseGeoJSON()
    }
    const sourceUUID = L_.asLayerUUID(sourceName)
    const sourceData = L_.layers.data[sourceUUID]
    if (sourceData == null) {
        console.warn(
            `Heatmap layer '${layerObj.name}': source layer '${sourceName}' not found in this mission.`
        )
        return F_.getBaseGeoJSON()
    }
    if (typeof ctx.acquire !== 'function') return F_.getBaseGeoJSON()
    const geojson = await ctx.acquire(sourceUUID)
    return applyLocalTimeWindow(sourceData, geojson || F_.getBaseGeoJSON())
}

export default {
    fetch,
}
