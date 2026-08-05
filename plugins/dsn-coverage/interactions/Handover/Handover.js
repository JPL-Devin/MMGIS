import L_ from '@basics/Layers_/Layers_'
import CursorInfo from '@basics/UserInterface_/components/CursorInfo/CursorInfo'

import { handoversFor, summarize } from './logic'

/**
 * The stations of the clicked layer.
 *
 * There is no way to ask the HorizonMask attachment which stations it drew, so
 * this reads what it left on the host — its `geojson` is stored verbatim under
 * `L_.layers.attachments[layer][attachmentId]` — and falls back to the host's
 * own Leaflet layer when the attachment is off.
 */
function stationsGeoJSON(layerName) {
    const attachments = L_.layers.attachments?.[L_.asLayerUUID(layerName)]
    const fromAttachment = attachments?.horizon_mask?.geojson
    if (fromAttachment) return fromAttachment
    try {
        return L_.layers.layer[layerName]?.toGeoJSON?.()
    } catch (e) {
        return null
    }
}

const Handover = {
    use(ctx) {
        if (!ctx.feature) return

        // The property names are the layer type's, normalized onto the layer;
        // this interaction's own settings sit on top of them.
        const result = handoversFor(
            ctx.feature,
            stationsGeoJSON(ctx.layerName),
            ctx.config,
            ctx.layerVar?.groundStation || {}
        )
        if (result == null) return

        CursorInfo.update(summarize(result), 6000, true)
        // Leave it for anything later in the pipeline.
        ctx.state.handover = result
    },
}

export default Handover
