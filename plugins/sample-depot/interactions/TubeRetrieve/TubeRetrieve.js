import L_ from '@basics/Layers_/Layers_'

import { addTube, fetchTubesGeoJSON, markRetrieved } from '../../lib/depotApi'
import { decide } from './logic'

const TubeRetrieve = {
    async use(ctx) {
        const result = decide(
            ctx.feature,
            ctx.config,
            ctx.event?.latlng || null,
            ctx.layerVar
        )
        if (result == null) return

        try {
            if (result.action === 'retrieve') await markRetrieved(result.id)
            else await addTube(result.tube)
        } catch (err) {
            console.warn('TubeRetrieve: write failed', err)
            return
        }

        // Make the layer reflect the write. There is no "re-acquire this layer"
        // call a plugin can make and no way to invoke the layer type's
        // source.fetch, so the interaction refetches through the same shared lib
        // the type uses and hands the result to core's vector updater.
        try {
            const geojson = await fetchTubesGeoJSON(
                ctx.layerVar?.depot || null
            )
            L_.updateVectorLayer(ctx.layerName, geojson)
        } catch (err) {
            console.warn('TubeRetrieve: reload failed', err)
        }

        ctx.state.tubeRetrieve = result
    },
}

export default TubeRetrieve
