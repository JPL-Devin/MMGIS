import { useCallback } from 'react'

import {
    orderingHistoryString,
    useLayersNewStore,
} from '../store'

export function useLayerOrdering(adapter) {
    const reorder = useCallback(
        (ordered, oldIndex, newIndex, depth) => {
            adapter.reorder(ordered)
            adapter.orderedBringToFront()
            const history = [
                ...useLayersNewStore.getState().orderingHistory,
                [
                oldIndex,
                newIndex,
                depth,
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
