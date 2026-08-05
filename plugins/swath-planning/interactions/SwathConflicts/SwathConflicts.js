import L_ from '@basics/Layers_/Layers_'

import { report } from './logic'

/** The host layer's features that are inside the current map view. */
function swathsInView(ctx) {
    const layer = L_.layers.layer?.[ctx.layerName]
    const layers = Array.isArray(layer) ? layer : [layer]
    const bounds = ctx.Map_?.map?.getBounds?.()
    const out = []
    layers.forEach((l) => {
        if (!l?.eachLayer) return
        l.eachLayer((sub) => {
            if (!sub.feature) return
            const b = sub.getBounds?.() || (sub.getLatLng ? sub.getLatLng().toBounds(1) : null)
            if (bounds && b && !bounds.intersects(b)) return
            out.push(sub.feature)
        })
    })
    return out
}

const SwathConflicts = {
    use(ctx) {
        if (!ctx.feature) return
        const result = report(ctx.feature, swathsInView(ctx), ctx.config)
        if (result == null) return
        // Left for anything later in the pipeline (the Info panel, a notify).
        ctx.state.swathConflicts = result
        if (ctx.event?.latlng && ctx.Map_?.map) {
            window.L.popup({ className: 'swathConflictsPopup' })
                .setLatLng(ctx.event.latlng)
                .setContent(`<div>${result.message}</div>`)
                .openOn(ctx.Map_.map)
        }
    },
}

export default SwathConflicts
