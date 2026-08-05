/**
 * TraverseStep — walk the selection along a rover traverse.
 *
 * On click it finds the layer's waypoints in traverse order, takes the clicked
 * (or currently active) waypoint as the anchor, and moves the selection to the
 * next one (previous when shift is held, or when `direction` is configured
 * "previous"), panning the map to it. So repeated clicks step an operator along
 * the drive.
 *
 * The ordering property lives on the layer's own config
 * (`variables.traverse.orderProp`), written by the RoverTraverse layer type —
 * this reads it from `ctx.layerData`, which is the whole layer config, not from
 * `ctx.config`, which is only this interaction's own settings.
 *
 * `stepIndex` is pulled out as a pure function so it can be unit-tested without
 * the app's globals. See plugins/core/interactions/README.md.
 */

import L_ from '@basics/Layers_/Layers_'

import { stepIndex } from './stepIndex'

const num = (v, fallback) =>
    Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback

const getIn = (obj, path) =>
    path == null
        ? undefined
        : String(path)
              .split('.')
              .reduce((o, k) => (o == null ? undefined : o[k]), obj)

// The layer's point sublayers, in traverse order (mirrors WaypointSol).
function orderedWaypointLayers(layerName, orderProp) {
    const group = L_.layers.layer[layerName]
    if (!group || typeof group.eachLayer !== 'function') return []
    const points = []
    group.eachLayer((l) => {
        if (l && l.feature && typeof l.getLatLng === 'function') points.push(l)
    })
    return points
        .map((l, index) => ({ l, index }))
        .sort((a, b) => {
            const av = num(getIn(a.l.feature.properties, orderProp), a.index)
            const bv = num(getIn(b.l.feature.properties, orderProp), b.index)
            return av === bv ? a.index - b.index : av - bv
        })
        .map((w) => w.l)
}

const TraverseStep = {
    use(ctx) {
        const traverse = ctx.layerVar?.traverse || {}
        const orderProp = traverse.orderProp || traverse.solProp || 'sol'

        const waypoints = orderedWaypointLayers(ctx.layerName, orderProp)
        if (waypoints.length === 0) return

        // Anchor: the clicked waypoint, else the currently active feature.
        const anchor = ctx.layer || L_.activeFeature?.layer
        let current = anchor ? waypoints.indexOf(anchor) : -1
        if (current < 0 && anchor?.feature) {
            current = waypoints.findIndex((w) => w.feature === anchor.feature)
        }

        const cfg = ctx.config || {}
        const reverse =
            cfg.direction === 'previous' ||
            ctx.event?.originalEvent?.shiftKey === true
        const wrap = cfg.wrap !== false

        const target = stepIndex(
            waypoints.length,
            current,
            reverse ? -1 : 1,
            wrap
        )
        if (target < 0) return

        const targetLayer = waypoints[target]
        L_.setActiveFeature(targetLayer)

        const latlng =
            typeof targetLayer.getLatLng === 'function'
                ? targetLayer.getLatLng()
                : null
        if (latlng && L_.Map_?.map) L_.Map_.map.panTo(latlng)

        // Let later interactions know where the walk landed.
        ctx.state.traverseIndex = target
        ctx.state.traverseFeature = targetLayer.feature
    },
}

export default TraverseStep
