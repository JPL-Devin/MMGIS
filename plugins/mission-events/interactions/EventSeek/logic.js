/**
 * EventSeek's decisions, with nothing imported from `src/essence` so they can be
 * unit tested in Node.
 */
import { windowForEvent, DEFAULT_START_PROP, DEFAULT_END_PROP } from '../../lib/eventTime'

/**
 * @param {object|null} feature   The clicked GeoJSON feature.
 * @param {object|null} layerData The host layer's config — its `time.startProp`
 *   and `time.endProp` name where the feature's timestamps live.
 * @param {object|null} config    This interaction's settings on the layer.
 * @returns {{startTime,endTime,currentTime}|null} null when there is nothing to seek to.
 */
export function decide(feature, layerData, config) {
    if (feature == null) return null
    const startProp = layerData?.time?.startProp || DEFAULT_START_PROP
    const endProp = layerData?.time?.endProp || DEFAULT_END_PROP
    const padSec = config?.padSec === 0 ? 0 : parseFloat(config?.padSec) || 300
    return windowForEvent(
        feature.properties?.[startProp],
        feature.properties?.[endProp],
        padSec
    )
}
