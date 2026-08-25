function runtimeDependencies() {
    const layerLegend = require('@basics/Layers_/legend/LayerLegend')
    return {
        legend: require('../../Legend/LegendTool').default,
        derive: layerLegend.deriveLegend,
        canDerive: layerLegend.derivesLegend,
    }
}

export function createLegendAdapter(dependencies = {}) {
    const defaults =
        dependencies.legend && dependencies.derive && dependencies.canDerive
            ? {}
            : runtimeDependencies()
    const { legend, derive, canDerive } = {
        ...defaults,
        ...dependencies,
    }
    return {
        derive: (layer) => derive(layer),
        derives: (layer) => canDerive(layer),
        refresh: (layer) => {
            const derived = derive(layer)
            legend.refreshLegends?.()
            return derived
        },
    }
}

let defaultAdapter
const getDefaultAdapter = () => {
    if (!defaultAdapter) defaultAdapter = createLegendAdapter()
    return defaultAdapter
}

const legendAdapter = new Proxy(
    {},
    {
        get: (_, property) => (...args) =>
            getDefaultAdapter()[property](...args),
    }
)

export default legendAdapter
