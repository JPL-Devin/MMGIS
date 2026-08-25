import React, { useEffect, useRef } from 'react'
import Sortable from 'sortablejs'

import LayerRow from './LayerRow'
import LayerToolbar from './LayerToolbar'
import { getChildCounts } from './layerRowHelpers'
import { rowMatchesSearch } from '../../hooks/useLayerTree'
import { useLayersNewStore } from '../../store'

function LayerList({
    rows,
    allRows,
    adapter,
    toggleLayer,
    onToggleHeader,
    onToggleGroupPower,
    onSort,
    onOpenSettings,
}) {
    const listRef = useRef(null)
    const search = useLayersNewStore((state) => state.search)
    const typeFilters = useLayersNewStore((state) => state.typeFilters)
    const visibleOnly = useLayersNewStore((state) => state.visibleOnly)
    const activeFilterOnly = useLayersNewStore(
        (state) => state.activeFilterOnly
    )
    const matchingRows = allRows.filter(
        (row) =>
            !row.structural &&
            (typeFilters.length === 0 || typeFilters.includes(row.type)) &&
            (!visibleOnly || row.on === true) &&
            (!activeFilterOnly || row.filtered === true) &&
            rowMatchesSearch(row, search)
    )
    useEffect(() => {
        if (!listRef.current) return undefined
        const sortable = Sortable.create(listRef.current, {
            animation: 150,
            handle: '.layersNewTool_dragHandle',
            onEnd: (event) => {
                if (event.oldIndex == null || event.newIndex == null) return
                const item = rows[event.oldIndex]
                const target = rows[event.newIndex]
                if (item && target) onSort(item, target, event)
            },
        })
        return () => sortable.destroy()
    }, [onSort, rows])

    return (
        <div className='layersNewTool_list'>
            <LayerToolbar
                rows={allRows}
            />
            <div className='layersNewTool_listRows' ref={listRef}>
                {rows.map((row) => (
                    <LayerRow
                        key={row.name}
                        row={
                            row.structural
                                ? {
                                      ...row,
                                      childCount: getChildCounts(
                                          row,
                                          allRows,
                                          matchingRows
                                      ).total,
                                      visibleChildCount: getChildCounts(
                                          row,
                                          allRows,
                                          matchingRows
                                      ).on,
                                  }
                                : row
                        }
                        adapter={adapter}
                        toggleLayer={toggleLayer}
                        onToggleHeader={onToggleHeader}
                        onToggleGroupPower={onToggleGroupPower}
                        onOpenSettings={onOpenSettings}
                    />
                ))}
            </div>
        </div>
    )
}

export default LayerList
