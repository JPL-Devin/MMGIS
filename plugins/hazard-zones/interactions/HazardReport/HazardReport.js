/**
 * HazardReport interaction — "which hazard zones is this feature in?"
 *
 * Clicking a feature on any vector-ish layer collects every enabled `hazardzone`
 * layer, tests the clicked feature's centroid against each zone and against the
 * exclusion band the HazardBuffer attachment derived, and reports the hits in a
 * popup. The result is also left on `ctx.state.hazardZones` so a later
 * interaction in the pipeline can use it.
 */
import L_ from '@basics/Layers_/Layers_'

import { centroidOf } from '../../lib/hazardGeometry'
import { reportFor, reportLines } from '../../lib/hazardReport'

const featuresOfLayer = (name) => {
    const layer = L_.layers.layer?.[name]
    if (!layer) return []
    if (Array.isArray(layer)) {
        return layer
            .map((l) => (typeof l?.toGeoJSON === 'function' ? l.toGeoJSON() : null))
            .filter(Boolean)
    }
    if (typeof layer.toGeoJSON !== 'function') return []
    const gj = layer.toGeoJSON()
    return gj?.features || (gj ? [gj] : [])
}

const HazardReport = {
    use(ctx) {
        if (!ctx.feature) return

        const { labelProperty = 'name', onlyVisibleZones = true } =
            ctx.config || {}

        const hits = reportFor(
            centroidOf(ctx.feature),
            L_.layers.data,
            featuresOfLayer,
            (name) => L_.layers.attachments?.[name],
            { onlyVisible: onlyVisibleZones !== false }
        )

        // Leave the finding for the rest of the pipeline.
        ctx.state.hazardZones = hits

        const label =
            ctx.feature.properties?.[labelProperty] ??
            ctx.feature.properties?.name ??
            'This feature'
        const lines = reportLines(hits, label)

        const latlng = ctx.event?.latlng
        const map = ctx.Map_?.map
        if (map && latlng && window.L) {
            window.L.popup({ className: 'hazardReportPopup' })
                .setLatLng(latlng)
                .setContent(
                    `<div style="font-size:13px;line-height:1.5">${lines
                        .map((l) => `<div>${l}</div>`)
                        .join('')}</div>`
                )
                .openOn(map)
        } else {
            console.log(lines.join('\n'))
        }
    },
}

export default HazardReport
