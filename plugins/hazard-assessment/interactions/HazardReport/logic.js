/**
 * HazardReport's decisions, with nothing imported from `src/essence`, so this is
 * the part `tests/` can cover.
 */
import { assess } from '../../lib/hazardGeometry'

const round = (m) => Math.round(m)

/** The [lng, lat] of the clicked candidate landing point. */
export function pointOf(feature, latlng) {
    if (feature?.geometry?.type === 'Point') return feature.geometry.coordinates
    if (latlng && Number.isFinite(latlng.lat)) return [latlng.lng, latlng.lat]
    return null
}

/**
 * Collect every hazard buffer any layer currently has built.
 *
 * There is no registry lookup by attachmentId for plugins, so this walks the
 * attachments core stored on every layer and picks out the objects HazardBuffer
 * left behind (`_buffers` on its own attachment object, which core keeps
 * verbatim).
 *
 * @param {Object} attachmentsByLayer  `L_.layers.attachments`
 * @param {string[]|null} onlyLayers   Restrict to these host layers, if configured.
 */
export function collectBuffers(attachmentsByLayer, onlyLayers) {
    const out = []
    for (const [layerName, attachments] of Object.entries(
        attachmentsByLayer || {}
    )) {
        if (onlyLayers?.length && !onlyLayers.includes(layerName)) continue
        const attachment = attachments?.hazard_buffer
        if (!attachment?._buffers) continue
        for (const buffer of attachment._buffers)
            out.push({ ...buffer, layerName })
    }
    return out
}

/**
 * @returns {{safe: boolean, inside: Array, nearest: Object|null, text: string}|null}
 */
export function report(point, buffers) {
    if (point == null) return null
    const { inside, nearest, safe } = assess(point, buffers)

    const lines = safe
        ? ['Outside every hazard keep-out buffer.']
        : inside.map(
              (b) =>
                  `Inside ${b.hazardClass || 'hazard'}${
                      b.id != null ? ` ${b.id}` : ''
                  } (${b.layerName}) — severity ${b.severity}, ${round(
                      -b.distanceToEdgeMeters
                  )} m inside its ${round(b.bufferMeters)} m buffer`
          )

    if (nearest)
        lines.push(
            `Nearest buffer edge: ${round(
                Math.abs(nearest.distanceToEdgeMeters)
            )} m ${nearest.distanceToEdgeMeters <= 0 ? 'inward' : 'away'} (${
                nearest.hazardClass || 'hazard'
            }, ${nearest.layerName})`
        )

    return { safe, inside, nearest, text: lines.join('<br/>') }
}
