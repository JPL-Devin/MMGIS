/**
 * The hazard report itself, kept out of the interaction module.
 *
 * The interaction imports `L_`, which pulls jQuery and cannot be imported in a
 * Node unit test, so everything testable lives here and the handler is only the
 * glue that reaches into MMGIS' singletons.
 */
import { zonesContaining } from './hazardGeometry'

export const HAZARD_TYPE = 'hazardzone'
export const BUFFER_ATTACHMENT = 'hazard_buffer'

/**
 * Every hazard zone currently on the map, paired with the buffered twin the
 * HazardBuffer attachment derived.
 *
 * @param {Object} layersData      `L_.layers.data`
 * @param {Function} layerFeatures `(layerName) → Feature[]`
 * @param {Function} attachmentsOf `(layerName) → L_.layers.attachments[name]`
 */
export function collectZones(layersData, layerFeatures, attachmentsOf, opts = {}) {
    const zones = []
    Object.keys(layersData || {}).forEach((name) => {
        const layerObj = layersData[name]
        if (layerObj?.type !== HAZARD_TYPE) return
        if (opts.onlyVisible && layerObj.visibility === false) return

        const buffered = attachmentsOf(name)?.[BUFFER_ATTACHMENT]?._bufferedFeatures
        ;(layerFeatures(name) || []).forEach((feature, i) => {
            zones.push({
                layerName: layerObj.display_name || name,
                feature,
                buffered: buffered?.[i] || null,
            })
        })
    })
    return zones
}

/** The lines the popup shows. */
export function reportLines(hits, featureLabel) {
    if (!hits.length) return [`${featureLabel} is clear of all hazard zones.`]
    return [
        `${featureLabel} falls in ${hits.length} hazard zone${
            hits.length === 1 ? '' : 's'
        }:`,
        ...hits.map(
            (h) =>
                `• ${h.name}${h.severity ? ` (${h.severity})` : ''} — ${
                    h.within === 'buffer' ? 'exclusion buffer' : 'inside zone'
                } · ${h.layerName}`
        ),
    ]
}

/** The whole report for a clicked feature, given the lookups. */
export function reportFor(point, layersData, layerFeatures, attachmentsOf, opts) {
    return zonesContaining(
        point,
        collectZones(layersData, layerFeatures, attachmentsOf, opts)
    )
}

export default { collectZones, reportLines, reportFor }
