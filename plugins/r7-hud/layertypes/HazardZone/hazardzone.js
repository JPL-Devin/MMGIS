/**
 * HazardZone layer type.
 *
 * A vector whose features carry a hazard severity. Everything about drawing,
 * picking, filtering and both globes is inherited from `vector` (manifest
 * `"extends": "vector"`); this module only owns the config surface, where it
 * gives the type its default styling knobs.
 */
import { SEVERITY_COLORS } from '../../lib/hazard'

function normalize(layerObj, ctx, inherited) {
    // Run Vector's normalize first — it sets `kind`, `radius` and friends.
    inherited()
    const v = (layerObj.variables = layerObj.variables || {})
    v.hazard = { colors: SEVERITY_COLORS, ...(v.hazard || {}) }
    return layerObj
}

const HazardZone = {
    config: { normalize },
}

export default HazardZone
