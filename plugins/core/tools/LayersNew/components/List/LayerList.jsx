import React, { useEffect, useRef } from 'react'
import Sortable from 'sortablejs'

import LayerRow from './LayerRow'
import LayerToolbar from './LayerToolbar'

function LayerList({
    rows,
    allRows,
    adapter,
    toggleLayer,
    onToggleHeader,
    onToggleGroupPower,
    onExpandAll,
    onCollapseAll,
    onRestoreExpansion,
    onSort,
    onOpenSettings,
}) {
    const listRef = useRef(null)
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
                onExpandAll={onExpandAll}
                onCollapseAll={onCollapseAll}
                onRestoreExpansion={onRestoreExpansion}
            />
            <div className='layersNewTool_listRows' ref={listRef}>
                {rows.map((row) => (
                    <LayerRow
                        key={row.name}
                        row={row}
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
