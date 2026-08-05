/**
 * truth:open's decisions, with nothing imported from `src/essence`, so this is
 * the part a Node unit test can drive.
 */
import { matchTruth, OFFSET_PROP, MATCH_ID_PROP } from '../../lib/crossref'

/**
 * What clicking a prediction should open.
 *
 * @param {object|null} feature The clicked prediction.
 * @param {object|null} config  This interaction's settings on the layer.
 * @param {Array} truths        Ground-truth features, gathered by the caller —
 *   the handler does that, because reaching another layer needs `L_`.
 * @returns {{truth: object, distance: number}|null}
 */
export function decide(feature, config, truths) {
    if (feature == null) return null
    const matchProp = config?.matchProp ?? MATCH_ID_PROP
    const maxDistanceMeters = parseFloat(config?.maxDistanceMeters) || Infinity
    const match = matchTruth(feature, truths || [], { matchProp, maxDistanceMeters })
    if (!match) return null
    return {
        truth: match.feature,
        // Prefer the offset the attachment already computed and wrote back onto
        // the prediction: the two must not disagree in the UI.
        distance: feature.properties?.[OFFSET_PROP] ?? Math.round(match.distance),
    }
}

/** The layer names this interaction should search, given its settings. */
export function truthLayerNames(config) {
    const names = config?.truthLayers
    if (Array.isArray(names)) return names
    if (typeof names === 'string' && names.length)
        return names.split(',').map((n) => n.trim())
    return []
}
