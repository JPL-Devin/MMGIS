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
import { useLayerSettings } from '../hooks/useLayerSettings'
import SettingsDrawer from './Settings/SettingsDrawer'
import SettingsPage from './Settings/SettingsPage'
import { getSettingsPresentation } from './settingsPresentation'

export { getSettingsPresentation }

const LayersPanel = ({ onClose, adapters = layersNewAdapters }) => {
    const rows = useLayerTree(adapters.layers)
    const allRows = useLayersNewStore((state) => state.layerTree)
    const setLayerTree = useLayersNewStore((state) => state.setLayerTree)
    const toggleLayer = useLayerVisibility(adapters.layers)
    const setHeaderState = useLayersNewStore((state) => state.setHeaderState)
    const setHeaderVisibility = useLayersNewStore(
        (state) => state.setHeaderVisibility
    )
    const selectLayer = useLayersNewStore((state) => state.selectLayer)
    const setSettingsTab = useLayersNewStore((state) => state.setSettingsTab)
    const setSettingsInvoker = useLayersNewStore(
        (state) => state.setSettingsInvoker
    )
    const selectedLayer = useLayersNewStore((state) => state.selectedLayer)
    const selectSettingsLayer = useLayersNewStore(
        (state) => state.selectLayer
    )
    const setSettingsPresentation = useLayersNewStore(
        (state) => state.setSettingsPresentation
    )
    const settings = useLayerSettings(adapters)
    useRefreshStatus()
    useRestyled()

    const onToggleHeader = (header) =>
        setHeaderState(header.name, !header.expanded)
    const onOpenSettings = (name, invoker, tab = 'settings') => {
        setSettingsInvoker(invoker)
        setSettingsTab(tab)
        setSettingsPresentation(
            getSettingsPresentation(
                adapters.layers.isMobile(),
                typeof window !== 'undefined' &&
                    window.matchMedia('(max-width: 600px)').matches
            )
        )
        selectLayer(name)
    }
    const onCloseSettings = useCallback(() => {
        const invoker = useLayersNewStore.getState().settingsInvoker
        selectSettingsLayer(null)
        setSettingsPresentation('list')
        useLayersNewStore.getState().setSettingsInvoker(null)
        if (invoker && typeof invoker.focus === 'function') invoker.focus()
    }, [selectSettingsLayer, setSettingsPresentation])
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
        const targetIndex = allRows.findIndex(
            (row) => row.name === target.name
        )
        const afterHeader = target.structural
            ? allRows
                  .slice(targetIndex + 1)
                  .some(
                      (row) =>
                          row.depth > target.depth &&
                          !row.structural &&
                          row.on === true
                  )
                ? 2
                : 1
            : 0
        if (oldIndex < 0 || newIndex < 0) return
        const nextRows = moveRows(allRows, oldIndex, newIndex, afterHeader)
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
                [oldIndex, newIndex, afterHeader],
            ])
    }, [adapters, allRows, setLayerTree])

    return (
        <div className='layersNewTool'>
            <div className='mmgisToolHeader'>
                <div>
                    <div className='layersNewTool_headerMain'>
                        <div className='mmgisToolTitle'>LayersNew</div>
                        <span className='layersNewTool_count'>
                            {rows.length} layers
                        </span>
                    </div>
                    <div className='layersNewTool_headerClose'>
                        <IconButton size='sm' onClick={onClose} title='Close Tool'>
                            <i className='mdi mdi-close mdi-18px' />
                        </IconButton>
                    </div>
                </div>
            </div>
            <div className='layersNewTool_content'>
                {selectedLayer && settings ? (
                    adapters.layers.isMobile() ||
                    (typeof window !== 'undefined' &&
                        window.matchMedia('(max-width: 600px)').matches) ? (
                        <SettingsPage
                            settings={settings}
                            onClose={onCloseSettings}
                        />
                    ) : (
                        <>
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
                                onOpenSettings={onOpenSettings}
                            />
                            <SettingsDrawer
                                settings={settings}
                                onClose={onCloseSettings}
                            />
                        </>
                    )
                ) : (
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
                        onOpenSettings={onOpenSettings}
                    />
                )}
            </div>
        </div>
    )
}

export default LayersPanel
