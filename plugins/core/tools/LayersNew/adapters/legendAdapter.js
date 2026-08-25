export function createLegendAdapter({ legend, derive, canDerive }) {
    return {
        derive: (layer) => derive(layer),
        derives: (layer) => canDerive(layer),
        refresh: (layer) => {
            const derived = derive(layer)
            legend.refreshLegends()
            return derived
        },
    }
}
