import {
    orderedLeafNames,
    replayOrderingHistory,
} from '../ordering'

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
    info,
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
            refreshFailed: layers.layers?.refreshFailed?.[name] === true,
        }),
        getLayerStates: () => {
            const names = Object.keys(layers.layers?.data || {})
            return Object.fromEntries(
                names.map((name) => [name, {
                    on: layers.layers?.on?.[name] === true,
                    opacity: layers.getLayerOpacity(name) ?? 0,
                    loading: layers.layers?.loading?.[name] === true,
                    refreshFailed: layers.layers?.refreshFailed?.[name] === true,
                }])
            )
        },
        getOrderedNames: () => [...(layers._layersOrdered || [])],
        getAvailableLayerTypes: () =>
            [...new Set(
                (layers.layers?.dataFlat || [])
                    .filter((layer) => layer?.type && layer.type !== 'header')
                    .map((layer) => layer.type)
            )],
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
            const rows = []
            const visit = (nodes, depth = 0) =>
                (Array.isArray(nodes) ? nodes : []).forEach((node) => {
                    const data = layerData(node.name) || node
                    const type = data.type || node.type
                    rows.push({
                        name: node.name,
                        depth,
                        structural: registry.isStructural(type),
                    })
                    visit(node.sublayers, depth + 1)
                })
            visit(layers.configData?.layers)
            const ordered = orderedLeafNames(
                replayOrderingHistory(rows, history)
            )
            layers.reorderLayers(ordered)
            map.orderedBringToFront()
            return ordered
        },
        orderedBringToFront: () => map.orderedBringToFront(),
        refreshLayer: (name) => map.refreshLayer(layerData(name)),
        fitBounds: (bounds) => map.map?.fitBounds(bounds),
        globe: () => globe,
        getSafeName: (name) => formulae.getSafeName(name),
        escapeHtml: (value) => formulae.escapeHtml(value),
        getDynamicProps: (name) => layers.getDynamicProps(name),
        getAggregations: (name, context) =>
            filtering.getAggregations(name, context),
        applyFilter: (name, context) => filtering.applyFilter(name, context),
        locate: (name) => {
            const data = layerData(name)
            const runtime = layers.layers?.layer?.[name]
            if (!data || !runtime) {
                toast.warning('Unable to locate layer.', 4000)
                return false
            }
            if (layers.layers?.on?.[name] !== true) {
                toast.warning(
                    'Please turn the layer on before locating.',
                    4000
                )
                return false
            }
            try {
                if (typeof runtime.getBounds === 'function')
                    map.map.fitBounds(runtime.getBounds())
                else if (data.boundingBox)
                    map.map.fitBounds([
                        [data.boundingBox[1], data.boundingBox[0]],
                        [data.boundingBox[3], data.boundingBox[2]],
                    ])
                else {
                    toast.warning('Unable to locate layer.', 4000)
                    return false
                }
                return true
            } catch (error) {
                toast.warning('Unable to locate layer.', 4000)
                return false
            }
        },
        openInfo: (name) => info.open(name),
        openTime: () => document.getElementById('timeUI')?.click(),
        refreshFailed: (name) => layers.layers?.refreshFailed?.[name] === true,
        initializeFiltering: () => filtering.initialize(),
        subscribeOnLayerToggle: (callback, subscriptionId = 'LayersNew') => {
            layers.subscribeOnLayerToggle(subscriptionId, callback)
            return () => layers.unsubscribeOnLayerToggle(subscriptionId)
        },
    }
}
