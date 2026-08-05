/**
 * ImageFootprints layer type.
 *
 * It draws exactly like a vector layer, so it `extends` vector and implements
 * only the surface that differs: `config`, where it defaults the viewing-geometry
 * property names that the LookDirection attachment and the StereoPairs
 * interaction both read, so a mission author configures them once on the layer
 * rather than three times.
 */

const STEREO_DEFAULTS = {
    emissionProp: 'emission_angle',
    incidenceProp: 'incidence_angle',
    azimuthProp: 'sub_spacecraft_azimuth',
}

/**
 * Fills in `variables.stereo` and mirrors it into the two consumers' own config
 * subtrees when they are configured but left blank — the only way found to let
 * one layer-level setting reach an attachment and an interaction, since each
 * family only ever sees the subtree at its own `configPath`.
 */
function normalize(layerObj) {
    const vars = layerObj.variables || (layerObj.variables = {})
    const stereo = { ...STEREO_DEFAULTS, ...(vars.stereo || {}) }
    vars.stereo = stereo

    const look = vars.layerAttachments?.lookDirection
    if (look)
        for (const key of Object.keys(STEREO_DEFAULTS))
            if (look[key] == null || look[key] === '') look[key] = stereo[key]

    const pairs = vars.interactions?.stereoPairs
    if (pairs)
        for (const key of Object.keys(STEREO_DEFAULTS))
            if (pairs[key] == null || pairs[key] === '') pairs[key] = stereo[key]

    return layerObj
}

export default {
    config: { normalize },
}
