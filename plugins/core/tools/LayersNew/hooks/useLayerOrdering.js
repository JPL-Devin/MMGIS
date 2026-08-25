import { useCallback } from 'react'

import {
    orderingHistoryString,
    useLayersNewStore,
} from '../store'

export function useLayerOrdering(adapter) {
    const reorder = useCallback(
        (ordered, oldIndex, newIndex, afterHeader) => {
            adapter.reorder(ordered)
            adapter.orderedBringToFront()
            const history = [
                ...useLayersNewStore.getState().orderingHistory,
                [
                oldIndex,
                newIndex,
                afterHeader,
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
