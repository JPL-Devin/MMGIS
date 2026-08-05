/**
 * HazardReport's decisions, with nothing imported from `src/essence`.
 */
import { classify } from '../../lib/hazard'

/**
 * @param {object|null} feature The clicked GeoJSON feature, if there was one.
 * @param {object|null} config  This interaction's settings on the layer.
 * @returns {{severity: string, label: string, level: number}|null}
 */
export function decide(feature, config) {
    return classify(feature, config)
}
