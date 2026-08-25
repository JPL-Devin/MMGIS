import React from 'react'

import {
    IconButton,
    IconTextButton,
    Toggle,
    Tooltip,
} from '@design/components'
import { getAvailableLayerTypes } from '../../hooks/useLayerTree'
import { useLayersNewStore } from '../../store'

const TYPE_LABELS = {
    vectortile: 'Vector tiles',
    tile: 'Raster',
}

function LayerToolbar({
    rows,
    onExpandAll,
    onCollapseAll,
    onRestoreExpansion,
}) {
    const search = useLayersNewStore((state) => state.search)
    const typeFilters = useLayersNewStore((state) => state.typeFilters)
    const visibleOnly = useLayersNewStore((state) => state.visibleOnly)
    const activeFilterOnly = useLayersNewStore(
        (state) => state.activeFilterOnly
    )
    const setSearch = useLayersNewStore((state) => state.setSearch)
    const setTypeFilters = useLayersNewStore((state) => state.setTypeFilters)
    const types = getAvailableLayerTypes(rows)

    const toggleType = (type) => {
        setTypeFilters(
            typeFilters.includes(type)
                ? typeFilters.filter((value) => value !== type)
                : [...typeFilters, type]
        )
    }

    return (
        <div className='layersNewTool_toolbar'>
            <div className='layersNewTool_search'>
                <i className='mdi mdi-magnify mdi-18px' />
                <input
                    aria-label='Search layers'
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder='Search layers or #tag'
                    list='layersNewTags'
                />
                {search && (
                    <Tooltip content='Clear search'>
                        <IconButton
                            size='sm'
                            aria-label='Clear search'
                            onClick={() => setSearch('')}
                        >
                            <i className='mdi mdi-close mdi-16px' />
                        </IconButton>
                    </Tooltip>
                )}
            </div>
            <div className='layersNewTool_filters' aria-label='Layer filters'>
                <Tooltip content='Expand all groups'>
                    <IconTextButton
                        size='sm'
                        icon={<i className='mdi mdi-arrow-expand mdi-14px' />}
                        aria-label='Expand all groups'
                        onClick={onExpandAll}
                    />
                </Tooltip>
                <Tooltip content='Collapse all groups'>
                    <IconTextButton
                        size='sm'
                        icon={<i className='mdi mdi-arrow-collapse mdi-14px' />}
                        aria-label='Collapse all groups'
                        onClick={onCollapseAll}
                    />
                </Tooltip>
                <Tooltip content='Restore configured expansion'>
                    <IconButton
                        size='sm'
                        aria-label='Restore configured expansion'
                        onClick={onRestoreExpansion}
                    >
                        <i className='mdi mdi-restore mdi-14px' />
                    </IconButton>
                </Tooltip>
                {types.map((type) => (
                    <Toggle
                        key={type}
                        pressed={typeFilters.includes(type)}
                        onPressedChange={() => toggleType(type)}
                        aria-label={`Filter ${TYPE_LABELS[type] || type}`}
                    >
                        {TYPE_LABELS[type] || type}
                    </Toggle>
                ))}
                <Toggle
                    pressed={visibleOnly}
                    onPressedChange={(value) =>
                        useLayersNewStore.getState().setVisibleOnly(value)
                    }
                    aria-label='Visible layers only'
                >
                    Visible
                </Toggle>
                <Toggle
                    pressed={activeFilterOnly}
                    onPressedChange={(value) =>
                        useLayersNewStore
                            .getState()
                            .setActiveFilterOnly(value)
                    }
                    aria-label='Layers with active filters only'
                >
                    Filtered
                </Toggle>
            </div>
            <datalist id='layersNewTags'>
                {[...new Set(rows.flatMap((row) => row.tags || []))].map(
                    (tag) => (
                        <option value={`#${tag}`} key={tag} />
                    )
                )}
            </datalist>
        </div>
    )
}

export default LayerToolbar
