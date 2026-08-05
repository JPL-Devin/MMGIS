import TimeControl from '@basics/TimeControl_/TimeControl'
import L_ from '@basics/Layers_/Layers_'

import { nextExtent } from './logic'

/**
 * Follow the clicked storm forwards or backwards in time: shift the time window
 * onto its next (or previous) observation and fit the map to that extent.
 *
 * The storm's other extents are not on the map — the DustStormFronts layer type
 * leaves the whole archive, and the property names it uses, on the layer object
 * as `_dustStorms`, which is what this reads.
 */
const StormTrack = {
    use(ctx) {
        const left = (L_.layers.data?.[ctx.layerName] || ctx.layerData || {})
            ._dustStorms
        const next = nextExtent(ctx.feature, ctx.config, left)
        if (next == null) return

        const at = new Date(next.feature.properties[next.props.timeProp])
        if (isNaN(at.getTime())) return

        // Keep the window's width, slid so the next observation sits in it.
        const start = new Date(TimeControl.getStartTime())
        const end = new Date(TimeControl.getEndTime())
        const width = end - start
        const newEnd = new Date(at.getTime() + Math.max(width, 0) / 2)
        const newStart = new Date(newEnd.getTime() - Math.max(width, 0))
        TimeControl.setTime(
            newStart.toISOString().split('.')[0] + 'Z',
            newEnd.toISOString().split('.')[0] + 'Z',
            false
        )

        const bounds = window.L.geoJson(next.feature).getBounds()
        if (bounds.isValid()) ctx.Map_?.map?.fitBounds(bounds)

        // For anything later in the pipeline (the postamble's info panel, say).
        ctx.state.stormTrack = {
            direction: next.direction,
            time: at.toISOString(),
        }
    },
}

export default StormTrack
