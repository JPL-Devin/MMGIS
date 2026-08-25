function runtimeDependencies() {
    return {
        layers: require('@basics/Layers_/Layers_').default,
        map: require('@basics/Map_/Map_').default,
        globe: require('@basics/Globe_/Globe_').default,
        filtering: require('@basics/Layers_/Filtering/Filtering').default,
        registry: require('@basics/Layers_/registry/LayerTypeRegistry').default,
    }
}

export function createLayersAdapter(dependencies = {}) {
    const defaults =
        dependencies.layers &&
        dependencies.map &&
        dependencies.filtering &&
        dependencies.registry
            ? {}
            : runtimeDependencies()
    const {
        layers,
        map,
        globe,
        filtering,
        registry,
    } = { ...defaults, ...dependencies }
    const layerData = (name) => {
        const uuid = layers.asLayerUUID?.(name) || name
        return layers.layers?.data?.[uuid] || layers.layers?.data?.[name]
    }

    return {
        getTree: () => layers.configData?.layers || [],
        getLayerData: layerData,
        getLayerRuntime: (name) => layers.layers?.layer?.[name],
        getLayerState: (name) => ({
            on: layers.layers?.on?.[name] === true,
            opacity: layers.getLayerOpacity?.(name) ?? 0,
            loading: layers.layers?.loading?.[name] === true,
        }),
        getLayerStates: () => {
            const names = Object.keys(layers.layers?.data || {})
            return Object.fromEntries(
                names.map((name) => [name, {
                    on: layers.layers?.on?.[name] === true,
                    opacity: layers.getLayerOpacity?.(name) ?? 0,
                    loading: layers.layers?.loading?.[name] === true,
                }])
            )
        },
        getOrderedNames: () => [...(layers._layersOrdered || [])],
        getToolVars: () => layers.getToolVars?.('layersnew') || {},
        isStructural: (typeId) => registry.isStructural(typeId),
        getTypeConfig: (typeId) => registry.getConfig(typeId),
        isFilterable: (name) => filtering.isFilterable(name),
        getFilters: () => filtering.filters,
        toggleLayer: (name) => {
            const layer = layerData(name)
            return layer ? layers.toggleLayer(layer) : undefined
        },
        setOpacity: (name, value) => layers.setLayerOpacity(name, value),
        setGlobalLoading: (name) => layers.setGlobalLoading(name),
        setGlobalLoaded: (name) => layers.setGlobalLoaded(name),
        set: (name, path, value) => {
            const layer = layerData(name)
            if (!layer) return
            const parts = path.split('.')
            const last = parts.pop()
            const target = parts.reduce(
                (valueAtPath, key) =>
                    valueAtPath[key] || (valueAtPath[key] = {}),
                layer
            )
            target[last] = value
        },
        resetSettings: (name, scope) =>
            layers.resetLayerSettings?.(name, scope),
        restyle: (layer) => layers.restyleLayer?.(layer),
        notify: (kind, message) => layers.notify?.(kind, message),
        reorder: (ordered) => layers.reorderLayers(ordered),
        orderedBringToFront: () => map.orderedBringToFront(),
        refreshLayer: (layer) => map.refreshLayer(layer),
        fitBounds: (bounds) => map.map?.fitBounds(bounds),
        globe: () => globe,
        initializeFiltering: () => filtering.initialize(),
        subscribeOnLayerToggle: (callback) => {
            layers.subscribeOnLayerToggle('LayersNew', callback)
            return () => layers.unsubscribeOnLayerToggle('LayersNew')
        },
    }
}

let defaultAdapter
const getDefaultAdapter = () => {
    if (!defaultAdapter) defaultAdapter = createLayersAdapter()
    return defaultAdapter
}

const layersAdapter = new Proxy(
    {},
    {
        get: (_, property) => (...args) =>
            getDefaultAdapter()[property](...args),
    }
)

export default layersAdapter
