/**
 * Radargram layer type — the `config` surface.
 *
 * A radargram track is drawn as free geometry, not draped: `layer3dType`
 * 'clamped' (the inherited Vector default) would flatten the ground track onto
 * the terrain and, more importantly, route the *inherited* globe path through
 * LithoSphere's 'clamped' layerer. Defaulted here rather than left to a mission
 * author, which is the pattern the layertypes README recommends for a setting a
 * type needs but does not own.
 */
import { DEFAULTS } from './lib/radargram'

function normalize(layerObj) {
    layerObj.layer3dType = layerObj.layer3dType || 'vector'
    layerObj.variables = layerObj.variables || {}
    layerObj.variables.radargram = {
        imageProp: DEFAULTS.imageProp,
        maxDepthMeters: DEFAULTS.maxDepthMeters,
        verticalExaggeration: DEFAULTS.verticalExaggeration,
        ...(layerObj.variables.radargram || {}),
    }
    return layerObj
}

export default { normalize }
