import { useEffect } from 'react'

import { useLayersNewStore } from '../store'

export function useRefreshStatus() {
    useEffect(() => {
        const handle = (event) => {
            const { layerName, failed } = event.detail || {}
            if (layerName)
                useLayersNewStore.getState().setLayerState(layerName, {
                    refreshFailed: failed === true,
                })
        }
        document.addEventListener('layerRefreshStatusChanged', handle)
        return () =>
            document.removeEventListener('layerRefreshStatusChanged', handle)
    }, [])
}
