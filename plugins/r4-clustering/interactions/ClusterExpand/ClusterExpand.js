/**
 * ClusterExpand — click a cluster to open it.
 *
 * Reads the cluster properties the `clusteredvector` layer type's source surface
 * wrote onto each feature. There is no supported way for one plugin to import
 * another's module, so the property names are duplicated (see
 * lib/clustering.js in the ClusteredVector layer type).
 */
const COUNT_PROP = '_clusterCount'
const BOUNDS_PROP = '_clusterBounds'
const MEMBERS_PROP = '_clusterMembers'

const num = (v, fallback) =>
    Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback

/**
 * What a click on this feature should do, given the interaction's settings.
 * Pure, so it is unit testable without a map.
 * @returns {{action: 'none'|'zoom'|'list', count: number, bounds?: number[], members?: Object[]}}
 */
export function planFor(feature, config = {}) {
    const props = feature?.properties || {}
    const count = num(props[COUNT_PROP], 0)
    if (count < num(config.minCount, 2)) return { action: 'none', count }

    const mode = config.mode || 'zoom'
    const members = props[MEMBERS_PROP]
    if (mode === 'list' && Array.isArray(members) && members.length)
        return { action: 'list', count, members }

    const bounds = props[BOUNDS_PROP]
    if (Array.isArray(bounds) && bounds.length === 4)
        return { action: 'zoom', count, bounds }

    return { action: 'none', count }
}

/** A degenerate cluster bounds (all points identical) still needs to zoom. */
function padded([minLng, minLat, maxLng, maxLat], pad) {
    if (maxLng - minLng > 1e-9 || maxLat - minLat > 1e-9)
        return [minLng, minLat, maxLng, maxLat]
    return [minLng - pad, minLat - pad, maxLng + pad, maxLat + pad]
}

const ClusterExpand = {
    use(ctx) {
        if (!ctx.feature) return
        const config = ctx.config || {}
        const plan = planFor(ctx.feature, config)
        if (plan.action === 'none') return

        // Later interactions (and anything listening) can see what happened.
        ctx.state.clusterExpand = plan

        if (plan.action === 'zoom') {
            const [minLng, minLat, maxLng, maxLat] = padded(
                plan.bounds,
                num(config.padDegrees, 0.001)
            )
            const map = ctx.Map_?.map
            if (map?.fitBounds)
                map.fitBounds(
                    [
                        [minLat, minLng],
                        [maxLat, maxLng],
                    ],
                    { maxZoom: num(config.maxZoom, 18), padding: [40, 40] }
                )
        } else if (plan.action === 'list') {
            // A list UI would be a tool of its own; the members are published on
            // ctx.state and on the layer so an Info panel or a tool can read them.
            if (ctx.layerData) ctx.layerData._clusterExpanded = plan.members
        }

        // A cluster is not a feature — nothing downstream should treat it as one.
        if (config.stopPipeline !== false) ctx.stop = true
    },
}

export default ClusterExpand
