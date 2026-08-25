import { useCallback } from 'react'

import {
    orderingHistoryString,
    useLayersNewStore,
} from '../store'

export function useLayerOrdering(adapter) {
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
