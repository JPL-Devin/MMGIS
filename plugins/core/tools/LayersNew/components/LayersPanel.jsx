import React, { useCallback } from 'react'

import { useLayerTree } from '../hooks/useLayerTree'
import { useLayerVisibility } from '../hooks/useLayerVisibility'
import { useRefreshStatus } from '../hooks/useRefreshStatus'
import { useRestyled } from '../hooks/useRestyled'
import { layersNewAdapters } from '../adapters/runtimeAdapters'
import { IconButton } from '@design/components'
import LayerList from './List/LayerList'
import { useLayersNewStore } from '../store'
import { moveRows } from '../ordering'
import { groupTogglePlan } from '../groups'

const LayersPanel = ({ onClose, adapters = layersNewAdapters }) => {
    const rows = useLayerTree(adapters.layers)
    const allRows = useLayersNewStore((state) => state.layerTree)
    const setLayerTree = useLayersNewStore((state) => state.setLayerTree)
    const toggleLayer = useLayerVisibility(adapters.layers)
    const setHeaderState = useLayersNewStore((state) => state.setHeaderState)
    const setHeaderVisibility = useLayersNewStore(
        (state) => state.setHeaderVisibility
    )
    useRefreshStatus()
    useRestyled()

    const onToggleHeader = (header) =>
        setHeaderState(header.name, !header.expanded)
    const onToggleGroupPower = async (header) => {
        const states = Object.fromEntries(
            allRows.map((row) => [
                row.name,
                adapters.layers.getLayerState(row.name).on,
            ])
        )
        const memory =
            useLayersNewStore.getState().headerVisibility[header.name] || []
        const plan = groupTogglePlan(allRows, header.name, memory, states)
        if (!plan.turningOn) {
            setHeaderVisibility(header.name, plan.memory)
            await Promise.all(plan.names.map((name) => toggleLayer(name)))
        } else {
            await Promise.all(
                plan.names
                    .filter(
                        (name) =>
                            adapters.layers.getLayerState(name).on !== true
                    )
                    .map((name) => toggleLayer(name))
            )
        }
        document.dispatchEvent(
            new CustomEvent('layersToolHeaderStateChange', {
                detail: { layerName: header.name },
            })
        )
    }
    const setAllHeaders = (value) =>
        allRows
            .filter((row) => row.structural)
            .forEach((row) => setHeaderState(row.name, value))
    const restoreExpansion = () =>
        allRows
            .filter((row) => row.structural)
            .forEach((row) =>
                setHeaderState(row.name, row.defaultExpanded === true)
            )
    const onSort = useCallback((item, target) => {
        const oldIndex = allRows.findIndex((row) => row.name === item.name)
        const newIndex = allRows.findIndex((row) => row.name === target.name)
        const depth =
            target.structural && target.name !== item.name
                ? target.depth + 1
                : target.depth
        if (oldIndex < 0 || newIndex < 0) return
        const nextRows = moveRows(allRows, oldIndex, newIndex, depth)
        if (nextRows === allRows) return
        const ordered = nextRows
            .filter((row) => !row.structural)
            .map((row) => row.name)
        adapters.layers.reorder(ordered)
        adapters.layers.orderedBringToFront()
        setLayerTree(nextRows)
        useLayersNewStore
            .getState()
            .setOrderingHistory([
                ...useLayersNewStore.getState().orderingHistory,
                [oldIndex, newIndex, depth],
            ])
    }, [adapters, allRows, setLayerTree])

    return (
        <div className='layersNewTool'>
            <div className='mmgisToolHeader'>
                <div>
                    <div className='mmgisToolTitle'>LayersNew</div>
                    <div className='layersNewTool_count'>
                        {rows.length} layers
                    </div>
                </div>
                <IconButton size='sm' onClick={onClose} title='Close Tool'>
                    <i className='mdi mdi-close mdi-18px' />
                </IconButton>
            </div>
            <div className='layersNewTool_content'>
                <LayerList
                    rows={rows}
                    allRows={allRows}
                    adapter={adapters.layers}
                    toggleLayer={toggleLayer}
                    onToggleHeader={onToggleHeader}
                    onToggleGroupPower={onToggleGroupPower}
                    onExpandAll={() => setAllHeaders(true)}
                    onCollapseAll={() => setAllHeaders(false)}
                    onRestoreExpansion={restoreExpansion}
                    onSort={onSort}
                />
            </div>
        </div>
    )
}

export default LayersPanel
