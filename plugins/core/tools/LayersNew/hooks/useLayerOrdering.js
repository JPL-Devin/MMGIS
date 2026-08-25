import { useCallback } from 'react'

import layersAdapter from '../adapters/layersAdapter'
import {
    orderingHistoryString,
    useLayersNewStore,
} from '../store'

export function useLayerOrdering(adapter = layersAdapter) {
    const reorder = useCallback(
        (ordered, oldIndex, newIndex, headerState) => {
            adapter.reorder(ordered)
            const history = [
                ...useLayersNewStore.getState().orderingHistory,
                [
                oldIndex,
                newIndex,
                headerState,
                ],
            ]
            useLayersNewStore.getState().setOrderingHistory(history)
        },
        [adapter]
    )
    return {
        reorder,
        getUrlString: () =>
            orderingHistoryString(
                useLayersNewStore.getState().orderingHistory
            ),
    }
}
