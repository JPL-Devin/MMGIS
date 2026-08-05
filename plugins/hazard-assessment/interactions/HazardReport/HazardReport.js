import L_ from '@basics/Layers_/Layers_'

import { collectBuffers, pointOf, report } from './logic'

/**
 * On clicking a candidate landing point, report which hazards' keep-out buffers
 * it falls inside and how far it is from the nearest edge.
 *
 * The buffers are not this plugin's to compute: it reads what HazardBuffer left
 * on its host layers (`L_.layers.attachments[host].hazard_buffer._buffers`),
 * since a plugin cannot call another plugin's operations. There is no lookup by
 * attachmentId, so every layer's attachments are walked.
 */
const HazardReport = {
    use(ctx) {
        const point = pointOf(ctx.feature, ctx.event?.latlng)
        if (point == null) return

        const onlyLayers = (ctx.config?.hazardLayers || '')
            .split(',')
            .map((n) => n.trim())
            .filter(Boolean)

        const buffers = collectBuffers(L_.layers.attachments, onlyLayers)
        const result = report(point, buffers)
        if (result == null) return

        // Left for anything later in the pipeline.
        ctx.state.hazardReport = result

        const leaflet = window.L
        const map = ctx.Map_?.map
        if (leaflet && map)
            leaflet
                .popup({ className: 'hazardReportPopup' })
                .setLatLng([point[1], point[0]])
                .setContent(
                    `<div><b>${
                        result.safe ? 'No hazard buffers' : 'Hazard buffers'
                    }</b><br/>${result.text}</div>`
                )
                .openOn(map)
    },
}

export default HazardReport
