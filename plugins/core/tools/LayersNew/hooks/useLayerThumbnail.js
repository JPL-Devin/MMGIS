import { useMemo } from 'react'

import LayerTypeRegistry from '@basics/Layers_/registry/LayerTypeRegistry'
import { useLayersNewStore } from '../store'

export function useLayerThumbnail(adapter) {
    const layerName = useLayersNewStore((state) => state.selectedLayer)
    return useMemo(() => {
        if (!layerName) return null
        const layer = adapter.getLayerData(layerName)
        const thumbnail = layer
            ? LayerTypeRegistry.getSettings(layer.type)?.thumbnail
            : null
        return typeof thumbnail === 'function'
            ? thumbnail(layer, adapter.getLayerRuntime(layerName))
            : thumbnail || null
    }, [adapter, layerName])
}
