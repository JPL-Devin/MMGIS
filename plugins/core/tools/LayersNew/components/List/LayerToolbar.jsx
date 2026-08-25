import React from 'react'

import {
    IconButton,
    Toggle,
    Tooltip,
} from '@design/components'
import { getAvailableLayerTypes } from '../../hooks/useLayerTree'
import { useLayersNewStore } from '../../store'

export const TYPE_LABELS = {
    vector: 'Vector',
    vectortile: 'Vector tiles',
    tile: 'Raster',
    query: 'Query',
    data: 'Data',
    model: 'Model',
    image: 'Image',
    velocity: 'Velocity',
}

function LayerToolbar({
    rows,
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
            <div className='layersNewTool_filterArea' aria-label='Layer filters'>
                <div className='layersNewTool_filterBlock'>
                    {types.map((type) => (
                        <Toggle
                            className='layersNewTool_filterChip'
                            key={type}
                            pressed={typeFilters.includes(type)}
                            onPressedChange={() => toggleType(type)}
                            aria-label={`Filter ${TYPE_LABELS[type] || type}`}
                        >
                            <span
                                className='layersNewTool_filterDot'
                                style={{
                                    '--filter-type-color': `var(--color-${type}, var(--color-a4))`,
                                }}
                            />
                            {TYPE_LABELS[type] || type}
                        </Toggle>
                    ))}
                    <Toggle
                        className='layersNewTool_filterChip layersNewTool_stateChip'
                        pressed={visibleOnly}
                        onPressedChange={(value) =>
                            useLayersNewStore.getState().setVisibleOnly(value)
                        }
                        aria-label='Visible layers only'
                    >
                        <i className='mdi mdi-eye-outline mdi-14px' />
                        Visible
                    </Toggle>
                    <Toggle
                        className='layersNewTool_filterChip layersNewTool_stateChip'
                        pressed={activeFilterOnly}
                        onPressedChange={(value) =>
                            useLayersNewStore
                                .getState()
                                .setActiveFilterOnly(value)
                        }
                        aria-label='Layers with active filters only'
                    >
                        <i className='mdi mdi-filter-outline mdi-14px' />
                        Filtered
                    </Toggle>
                    <span className='layersNewTool_filterCount'>
                        {rows.filter((row) => !row.structural).length} layers
                    </span>
                </div>
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
