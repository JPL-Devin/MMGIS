import { useMemo } from 'react'

import LayerTypeRegistry from '@basics/Layers_/registry/LayerTypeRegistry'
import layersAdapter from '../adapters/layersAdapter'
import legendAdapter from '../adapters/legendAdapter'
import { useLayersNewStore } from '../store'

export function createLayerSettingsApi(layer, layerName, adapter = layersAdapter) {
    return {
        get: (path) =>
            path.split('.').reduce((value, key) => value?.[key], layer),
        set: (path, value) => {
            adapter.set(layerName, path, value)
        },
        isOn: () => adapter.getLayerState(layerName).on,
        ensureOn: async () => {
            if (!adapter.getLayerState(layerName).on)
                await adapter.toggleLayer(layerName)
        },
        opacity: () => adapter.getLayerState(layerName).opacity,
        setOpacity: (value) => adapter.setOpacity(layerName, value),
        restyle: () => adapter.restyle(layer),
        refreshLayer: () => adapter.refreshLayer(layer),
        refreshLegend: () => legendAdapter.refresh(layer),
        resetSettings: (scope) => adapter.resetSettings(layerName, scope),
        notify: (kind, message) => adapter.notify(kind, message),
        runtime: () => adapter.getLayerRuntime(layerName),
        globe: () => adapter.globe(),
        vars: () => layer.variables || {},
        capabilities: () => LayerTypeRegistry.capabilities(layer.type),
        withTitiler:
            typeof window !== 'undefined' &&
            window.mmgisglobal?.WITH_TITILER === 'true',
    }
}

export function useLayerSettings(adapter = layersAdapter) {
    const layerName = useLayersNewStore((state) => state.selectedLayer)
    return useMemo(() => {
        if (!layerName) return null
        const layer = adapter.getLayerData(layerName)
        if (!layer) return null
        const settings = LayerTypeRegistry.getSettings(layer.type)
        const ctx = {
            capabilities: LayerTypeRegistry.capabilities(layer.type),
            api: createLayerSettingsApi(layer, layerName, adapter),
            isOn: adapter.getLayerState(layerName).on,
            runtime: adapter.getLayerRuntime(layerName),
            vars: layer.variables || {},
        }
        return {
            layer,
            layerName,
            ctx,
            sections: settings?.sections?.(layer, ctx) || [],
            tabs: settings?.tabs?.(layer, ctx) || null,
        }
    }, [adapter, layerName])
}
