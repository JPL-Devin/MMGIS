import { useCallback, useEffect } from 'react'

import { useLayersNewStore } from '../store'

export function useLayerVisibility(adapter) {
    useEffect(() => {
        const handle = (name, isOn) => {
            useLayersNewStore.getState().setLayerState(name, { on: isOn })
        }
        const unsubscribe = adapter.subscribeOnLayerToggle(
            handle,
            'LayersNewVisibility'
        )
        const onDocumentToggle = (event) => {
            const { layerName, isOn } = event.detail || {}
            if (layerName != null) handle(layerName, isOn)
        }
        document.addEventListener('layerVisibilityChange', onDocumentToggle)
        return () => {
            unsubscribe()
            document.removeEventListener(
                'layerVisibilityChange',
                onDocumentToggle
            )
        }
    }, [adapter])

    return useCallback(
        async (name) => {
            const store = useLayersNewStore.getState()
            if (store.loading[name]) return false
            store.setLoading(name, true)
            adapter.setGlobalLoading(name)
            try {
                await adapter.toggleLayer(name)
                return true
            } finally {
                adapter.setGlobalLoaded(name)
                useLayersNewStore.getState().setLoading(name, false)
            }
        },
        [adapter]
    )
}
