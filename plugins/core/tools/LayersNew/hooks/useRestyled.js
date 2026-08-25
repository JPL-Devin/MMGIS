import { useEffect } from 'react'

import { useLayersNewStore } from '../store'
import { RESTYLED_EVENT as DYNAMIC_STYLE_RESTYLED_EVENT } from '@basics/Layers_/render/dynamicStyleRuntime'

export const RESTYLED_EVENT = DYNAMIC_STYLE_RESTYLED_EVENT

export function useRestyled() {
    useEffect(() => {
        const handle = (event) => {
            const layerName = event.detail?.layer
            if (layerName)
                useLayersNewStore.getState().setLayerState(layerName, {
                    restyledAt: Date.now(),
                })
        }
        document.addEventListener(RESTYLED_EVENT, handle)
        return () => document.removeEventListener(RESTYLED_EVENT, handle)
    }, [])
}
