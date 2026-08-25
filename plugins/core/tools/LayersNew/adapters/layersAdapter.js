export function createLayersAdapter({
    layers,
    map,
    globe,
    formulae,
    filtering,
    registry,
    resetDynamicStyle,
    restyleDynamicStyle,
    toast,
}) {
    const layerData = (name) => {
        const uuid = layers.asLayerUUID(name) || name
        return layers.layers?.data?.[uuid] || layers.layers?.data?.[name]
    }

    return {
        getTree: () => layers.configData?.layers || [],
        getLayerData: layerData,
        getLayerRuntime: (name) => layers.layers?.layer?.[name],
        getLayerState: (name) => ({
            on: layers.layers?.on?.[name] === true,
            opacity: layers.getLayerOpacity(name) ?? 0,
            loading: layers.layers?.loading?.[name] === true,
        }),
        getLayerStates: () => {
            const names = Object.keys(layers.layers?.data || {})
            return Object.fromEntries(
                names.map((name) => [name, {
                    on: layers.layers?.on?.[name] === true,
                    opacity: layers.getLayerOpacity(name) ?? 0,
                    loading: layers.layers?.loading?.[name] === true,
                }])
            )
        },
        getOrderedNames: () => [...(layers._layersOrdered || [])],
        getToolVars: () => layers.getToolVars('layersnew') || {},
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
        resetSettings: (name) => {
            layers.setLayerOpacity(name, 1)
            layers.setLayerFilter(name, 'clear')
            resetDynamicStyle(layerData(name), null)
        },
        restyle: (layer) => restyleDynamicStyle(layer),
        notify: (kind, message) => {
            if (kind === 'error') return toast.error(message, 3000)
            return toast.info(message)
        },
        reorder: (ordered) => layers.reorderLayers(ordered),
        applyOrderingHistory: (history) => {
            const ordered = [...(layers._layersOrdered || [])]
            history.forEach(([oldIndex, newIndex]) => {
                if (
                    oldIndex < 0 ||
                    oldIndex >= ordered.length ||
                    newIndex < 0 ||
                    newIndex >= ordered.length
                )
                    return
                const [name] = ordered.splice(oldIndex, 1)
                ordered.splice(newIndex, 0, name)
            })
            layers.reorderLayers(ordered)
            map.orderedBringToFront()
            return ordered
        },
        orderedBringToFront: () => map.orderedBringToFront(),
        refreshLayer: (layer) => map.refreshLayer(layer),
        fitBounds: (bounds) => map.map?.fitBounds(bounds),
        globe: () => globe,
        getSafeName: (name) => formulae.getSafeName(name),
        escapeHtml: (value) => formulae.escapeHtml(value),
        getDynamicProps: (name) => layers.getDynamicProps(name),
        getAggregations: (name, context) =>
            filtering.getAggregations(name, context),
        applyFilter: (name, context) => filtering.applyFilter(name, context),
        initializeFiltering: () => filtering.initialize(),
        subscribeOnLayerToggle: (callback, subscriptionId = 'LayersNew') => {
            layers.subscribeOnLayerToggle(subscriptionId, callback)
            return () => layers.unsubscribeOnLayerToggle(subscriptionId)
        },
    }
}
