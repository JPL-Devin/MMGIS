const ChainTop = {
    config: {
        normalize(layerObj, ctx, inherited) {
            inherited()
            layerObj.variables = layerObj.variables || {}
            layerObj.variables.chainTopSaw = true
        },
    },
}

export default ChainTop
