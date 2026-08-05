/**
 * GroundStation layer type — extends `vector`.
 *
 * Stations come out of an ordinary GeoJSON url, so the inherited vector
 * source/renderer is all the drawing this type needs. What it owns is the
 * *config*: defaulting the property names a station's antenna diameter, mask
 * elevation and band live under, so the rest of the container (and a mission
 * author) has one place they are written down.
 */
import { DEFAULT_PROPS } from '../../lib/coverage'

/**
 * Fill in the station property names an admin did not, before core (or any
 * attachment core hands them to) reads the layer.
 */
function normalize(layerObj) {
    const v = (layerObj.variables = layerObj.variables || {})
    v.groundStation = { ...DEFAULT_PROPS, ...(v.groundStation || {}) }
    return layerObj
}

const GroundStation = {
    config: { normalize },
}

export default GroundStation
