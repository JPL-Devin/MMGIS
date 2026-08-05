/**
 * ClusteredVector — the `config` surface.
 *
 * Re-clustering on zoom is core's dynamic-extent refetch, and that is a *layer*
 * setting rather than a type declaration, so default it here (per the layertype
 * README) instead of expecting a mission author to know to set it.
 */
function normalize(layerObj) {
    layerObj.variables = layerObj.variables || {}
    if (layerObj.variables.dynamicExtent == null)
        layerObj.variables.dynamicExtent = true
    return layerObj
}

export default { normalize }
