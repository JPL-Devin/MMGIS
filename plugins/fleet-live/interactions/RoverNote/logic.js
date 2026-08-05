/**
 * RoverNote's decisions, with nothing imported from `src/essence`.
 */
import { FLEET_PROPS } from '../../lib/fleetApi'

/**
 * @param {object|null} feature  The clicked GeoJSON feature, if there was one.
 * @param {object|null} config   This interaction's settings on the layer.
 * @returns {{rover: string, note: string}|null} null when there is nothing to do.
 */
export function decide(feature, config) {
    if (feature == null) return null
    const { idProp = FLEET_PROPS.id, notePrefix = 'Acknowledged' } =
        config || {}
    const rover = feature.properties?.[idProp]
    if (rover == null) return null
    return {
        rover: String(rover),
        note: `${notePrefix} ${new Date().toISOString()}`,
    }
}
