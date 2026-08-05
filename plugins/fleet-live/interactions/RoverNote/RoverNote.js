import L_ from '@basics/Layers_/Layers_'

import { decide } from './logic'
import { postNote } from '../../lib/fleetApi'

const RoverNote = {
    async use(ctx) {
        const result = decide(ctx.feature, ctx.config)
        if (result == null) return

        try {
            await postNote(result.rover, result.note)
        } catch (err) {
            console.warn('RoverNote: failed to write note', err)
            return
        }

        // Make the layer reflect the write. There is no "this layer's data
        // changed, re-acquire it" call in the interaction ctx, so we reach for
        // the singleton: Map_.refreshLayer(layerObj) is what core's own
        // refresh intervals use, and for a source-backed vector layer it ends
        // in source.fetch again.
        const layerObj = ctx.layerData || L_.layers.data[ctx.layerName]
        if (layerObj) await L_.Map_?.refreshLayer?.(layerObj)

        ctx.state.roverNote = result
        window.dispatchEvent(
            new CustomEvent('fleet-live:changed', { detail: result })
        )
    },
}

export default RoverNote
