import L_ from '@basics/Layers_/Layers_'
import TimeControl from '@basics/TimeControl_/TimeControl'
import { decide, nearestAsset } from './logic'

/** The asset layer's point features, as `{ name, coord }`. */
function assetsOf(layerName) {
    const leafletLayer = L_.layers.layer[layerName]
    const out = []
    const push = (f) => {
        if (f?.geometry?.type === 'Point')
            out.push({
                name: f.properties?.name || f.properties?.id || layerName,
                coord: f.geometry.coordinates,
            })
    }
    if (Array.isArray(leafletLayer)) leafletLayer.forEach((l) => push(l?.feature))
    else if (leafletLayer?.eachLayer) leafletLayer.eachLayer((l) => push(l.feature))
    return out
}

const NextCommWindow = {
    use(ctx) {
        if (!ctx.feature) return
        const config = ctx.config || {}
        const assetLayerName = config.assetLayerName
        if (!assetLayerName) return

        const asset = nearestAsset(assetsOf(assetLayerName), ctx.event?.latlng)
        // The footprint attachment on the asset layer already computed a mask;
        // read it from there so both draw the same circle (see container README).
        const assetVars = L_.layers.data[assetLayerName]?.variables || {}
        const footprintCfg = assetVars.layerAttachments?.visibilityFootprint || {}
        const window_ = decide(
            ctx.feature,
            {
                elevationMaskDeg: footprintCfg.elevationMaskDeg,
                bodyRadiusMeters: footprintCfg.bodyRadiusMeters,
                ...config,
            },
            asset,
            {
                nowMs:
                    Date.parse(TimeControl.getTime?.()) ||
                    Date.parse(TimeControl.getStartTime?.()) ||
                    Date.now(),
                altitudeMeters:
                    ctx.layerData?.variables?.altitudeMeters ??
                    footprintCfg.altitudeMeters,
            }
        )

        ctx.state.nextCommWindow = window_
        if (window_ == null) return

        const start = new Date(window_.startMs).toISOString()
        const end = new Date(window_.endMs).toISOString()
        const ok = window.confirm(
            `Next window over ${window_.assetName}:\n` +
                `${start} → ${end} (${window_.durationSec}s)\n\n` +
                `Move the clock to its start?`
        )
        if (ok && TimeControl.enabled)
            TimeControl.setTime(start, TimeControl.getEndTime(), false)
    },
}

export default NextCommWindow
