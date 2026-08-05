import L_ from '@basics/Layers_/Layers_'

import { decide, REPORT_EVENT } from './logic'

/**
 * Collect the layer's other features so the report can name what overlaps.
 *
 * This reads the *host's own* render, not another layer's — the unsupported
 * cross-layer composition the plugin docs warn about — but there is still no
 * core-provided "the features of the layer this click came from": `ctx` carries
 * the one feature. `eachLayer` is the closest thing, and it sees only what is
 * drawn, so on a dynamic-extent layer the answer is viewport-limited.
 */
function siblingsOf(layerName) {
    const group = L_.layers?.layer?.[layerName]
    if (!group || typeof group.eachLayer !== 'function') return []
    const features = []
    group.eachLayer((l) => {
        if (l?.feature) features.push(l.feature)
    })
    return features
}

const FovInspect = {
    use(ctx) {
        if (!ctx.feature) return

        const report = decide(ctx.feature, siblingsOf(ctx.layerName), ctx.config)
        if (report == null) return

        // Later interactions in the pipeline can read this.
        ctx.state.fovReport = report

        // There is no core channel from an interaction to a component, so the
        // container's own namespaced CustomEvent is the seam — a convention
        // between two plugins shipped together, per
        // plugins/core/components/README.md.
        document.dispatchEvent(
            new CustomEvent(REPORT_EVENT, {
                detail: { ...report, layerName: ctx.layerName },
            })
        )
    },
}

export default FovInspect
