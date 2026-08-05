/**
 * WindReport's decisions, with nothing imported from `src/essence`, so this is
 * the part the unit test covers.
 */
import { report } from '../../lib/wind'

/**
 * @param {object|null} feature The clicked GeoJSON feature, if there was one.
 * @param {object|null} config  This interaction's settings on the layer.
 * @returns {{text: string, category: string}|null} null when there is nothing to say.
 */
export function decide(feature, config) {
    if (feature == null) return null
    // The layer type normalizes onto windSpeed/windDirection, so these defaults
    // are the same facts the type declares to the attachment — there is no way
    // for the type to hand them to an interaction, so they are duplicated here.
    return report(feature, {
        speedProp: config?.speedProp || 'windSpeed',
        directionProp: config?.directionProp || 'windDirection',
    })
}
