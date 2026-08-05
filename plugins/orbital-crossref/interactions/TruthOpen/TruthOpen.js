import L_ from '@basics/Layers_/Layers_'

import { decide, truthLayerNames } from './logic'

/**
 * Gather the candidate ground-truth features.
 *
 * The interaction is handed only the layer that was clicked (`ctx.layerName`,
 * `ctx.layerData`), so the other layer has to be found through `L_` by a name
 * an admin typed. Nothing in `ctx` reaches across layers.
 */
function truthFeaturesFor(names) {
    const out = []
    for (const rawName of names) {
        const name = L_.asLayerUUID ? L_.asLayerUUID(rawName) : rawName
        const live = L_.layers?.layer?.[name]
        if (!live) continue
        for (const c of Array.isArray(live) ? live : [live]) {
            const gj = typeof c?.toGeoJSON === 'function' ? c.toGeoJSON() : null
            for (const f of gj?.features || []) out.push({ ...f, _layerName: name })
        }
    }
    return out
}

const TruthOpen = {
    use(ctx) {
        if (!ctx.feature) return

        const names = truthLayerNames(ctx.config)
        if (!names.length) {
            // The layer names live in the *attachment's* config subtree, and a
            // plugin must not read another plugin's settings — so with nothing
            // configured here there is nothing this interaction can do.
            console.warn(
                'truth:open: no truthLayers configured on the interaction; nothing to open.'
            )
            return
        }

        const result = decide(ctx.feature, ctx.config, truthFeaturesFor(names))
        if (!result) return

        L_.selectFeature(result.truth._layerName, result.truth)
        ctx.state.truthOpen = {
            layerName: result.truth._layerName,
            offsetMeters: result.distance,
        }
    },
}

export default TruthOpen
