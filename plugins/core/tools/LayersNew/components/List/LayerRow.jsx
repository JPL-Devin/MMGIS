import React from 'react'

import { Checkbox, Dropdown, IconButton, Tooltip } from '@design/components'
import { useLayersNewStore } from '../../store'
import {
    markLayerThumbnailFailed,
    useLayerThumbnail,
} from '../../hooks/useLayerThumbnail'
import { deriveLegend, derivesLegend } from '@basics/Layers_/legend/LayerLegend'
import { badgeText } from './layerRowHelpers'

function Action({ label, icon, onClick, disabled = false }) {
    return (
        <Tooltip content={label}>
            <IconButton
                size='sm'
                aria-label={label}
                disabled={disabled}
                onClick={onClick}
            >
                <i className={`mdi mdi-${icon} mdi-16px`} />
            </IconButton>
        </Tooltip>
    )
}

function menuKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        event.currentTarget.click()
    }
}

function LayerRow({
    row,
    adapter,
    toggleLayer,
    onToggleHeader,
    onToggleGroupPower,
    onOpenSettings,
}) {
    const selectLayer = useLayersNewStore((state) => state.selectLayer)
    const search = useLayersNewStore((state) => state.search)
    const storeLoading = useLayersNewStore(
        (state) => state.loading[row.name] === true
    )
    const busy = row.loading === true || storeLoading
    const unavailable =
        !row.structural && adapter.getLayerRuntime(row.name) == null
    const color = `var(--color-${row.type}, var(--color-a4))`
    const thumbnail = useLayerThumbnail(row.name, adapter)
    const [thumbnailFailed, setThumbnailFailed] = React.useState(false)
    const rasterType = ['tile', 'image', 'data', 'velocity'].includes(row.type)
    const layerData = adapter.getLayerData(row.name)
    const legend = layerData?._legend || layerData?.variables?.legend
    if (layerData && !legend && derivesLegend(layerData)) deriveLegend(layerData)
    const legendEntries = Array.isArray(layerData?._legend)
        ? layerData._legend
        : []
    const legendColors = legendEntries
        .map((entry) => entry?.color || entry?.strokecolor)
        .filter(Boolean)
    const legendStyle =
        legendColors.length > 1 &&
        legendEntries.some((entry) => entry?.shape === 'continuous')
            ? {
                  background: `linear-gradient(to right, ${legendColors.join(
                      ', '
                  )})`,
              }
            : legendColors.length > 1
              ? {
                    background: `linear-gradient(to right, ${legendColors
                        .slice(0, 5)
                        .map(
                            (entryColor, index, colors) =>
                                `${entryColor} ${(index / colors.length) * 100}% ${
                                    ((index + 1) / colors.length) * 100
                                }%`
                        )
                        .join(', ')})`,
                }
              : legendColors.length === 1
                ? { background: legendColors[0] }
                : null

    if (row.structural)
        return (
            <div
                className='layersNewTool_row layersNewTool_header'
                style={{
                    '--layer-indent': `${row.depth * 13}px`,
                    '--layer-type-color': color,
                }}
                data-layer-name={row.name}
            >
                <button
                    className='layersNewTool_headerToggle'
                    aria-label={`${row.expanded ? 'Collapse' : 'Expand'} ${
                        row.displayName
                    }`}
                    onClick={() => onToggleHeader(row)}
                >
                    <i
                        className={`mdi mdi-chevron-${
                            row.expanded ? 'down' : 'right'
                        } mdi-16px`}
                    />
                </button>
                <span className='layersNewTool_dragHandle'>
                    <i className='mdi mdi-drag-vertical mdi-14px' />
                </span>
                <span className='layersNewTool_headerName'>{row.displayName}</span>
                <span className='layersNewTool_count'>
                    {row.visibleChildCount ?? 0}/{row.childCount ?? 0}
                </span>
                <Tooltip content='Toggle group layers'>
                    <IconButton
                        size='sm'
                        aria-label={`Toggle ${row.displayName}`}
                        onClick={() => onToggleGroupPower(row)}
                    >
                        <i className='mdi mdi-power mdi-16px' />
                    </IconButton>
                </Tooltip>
            </div>
        )

    return (
        <div
            className={`layersNewTool_row layersNewTool_layer ${
                busy ? 'is-loading' : ''
            } ${unavailable ? 'is-unavailable' : ''}`}
            style={{
                '--layer-indent': `${row.depth * 13}px`,
                '--layer-type-color': color,
            }}
            data-layer-name={row.name}
        >
            <span className='layersNewTool_dragHandle'>
                <i className='mdi mdi-drag-vertical mdi-14px' />
            </span>
            <Checkbox
                checked={row.on}
                disabled={busy || unavailable}
                onCheckedChange={() => toggleLayer(row.name)}
                aria-label={`Toggle ${row.displayName}`}
            />
            {thumbnail && !thumbnailFailed ? (
                <img
                    className='layersNewTool_thumbnail'
                    src={thumbnail}
                    alt=''
                    onError={() => {
                        markLayerThumbnailFailed(row.name)
                        setThumbnailFailed(true)
                    }}
                />
            ) : legendStyle ? (
                <span
                    className='layersNewTool_legendSwatch'
                    style={legendStyle}
                    aria-hidden='true'
                />
            ) : rasterType ? (
                <span
                    className='layersNewTool_legendSwatch layersNewTool_typeFallback'
                    style={{ background: color }}
                    aria-label='Thumbnail unavailable'
                />
            ) : null}
            <button
                className='layersNewTool_name'
                onClick={() => selectLayer(row.name)}
                title={
                    row.description
                        ? `${row.displayName} — ${row.description}`
                        : row.displayName
                }
            >
                {highlight(row.displayName, search)}
            </button>
            {unavailable && (
                <span className='layersNewTool_unavailable'>Unavailable</span>
            )}
            {row.refreshFailed && (
                <span title='Layer refresh failed'>
                    <i className='mdi mdi-alert-outline mdi-14px' />
                </span>
            )}
            {row.filtered && (
                <span title='Active filter'>
                    <i className='mdi mdi-filter mdi-14px' />
                </span>
            )}
            {row.timeEnabled && (
                <span title='Time enabled'>
                    <i className='mdi mdi-clock-outline mdi-14px' />
                </span>
            )}
            {badgeText(row.tags) && (
                <span
                    className='layersNewTool_badges'
                    title={(row.tags || []).join(', ')}
                >
                    <span className='layersNewTool_badge'>
                        {badgeText(row.tags)}
                    </span>
                </span>
            )}
            <span className='layersNewTool_actions'>
                <Action
                    label='Settings'
                    icon='tune'
                    onClick={(event) =>
                        onOpenSettings(row.name, event.currentTarget)
                    }
                    disabled={unavailable}
                />
                <Action
                    label='Locate'
                    icon='crosshairs-gps'
                    onClick={() => adapter.locate(row.name)}
                    disabled={busy}
                />
                <Dropdown
                    trigger={
                        <IconButton
                            size='sm'
                            aria-label='More layer actions'
                        >
                            <i className='mdi mdi-dots-vertical mdi-16px' />
                        </IconButton>
                    }
                >
                    <Dropdown.Item tabIndex={0} onKeyDown={menuKeyDown}
                        onClick={() =>
                            adapter.notify('info', 'Export coming soon.')
                        }
                    >
                        <i className='mdi mdi-download mdi-14px' /> Export
                    </Dropdown.Item>
                    <Dropdown.Item tabIndex={0} onKeyDown={menuKeyDown}
                        onClick={() => adapter.openInfo(row.name)}>
                        <i className='mdi mdi-information-outline mdi-14px' /> Information
                    </Dropdown.Item>
                    {row.timeEnabled && (
                        <Dropdown.Item tabIndex={0} onKeyDown={menuKeyDown}
                            onClick={(event) =>
                                onOpenSettings(
                                    row.name,
                                    event.currentTarget,
                                    'time'
                                )
                            }
                        >
                            <i className='mdi mdi-clock-outline mdi-14px' /> Time
                        </Dropdown.Item>
                    )}
                    <Dropdown.Item
                        tabIndex={busy || unavailable ? -1 : 0}
                        onKeyDown={menuKeyDown}
                        aria-disabled={busy || unavailable}
                        onClick={
                            busy || unavailable
                                ? undefined
                                : () => adapter.refreshLayer(row.name)
                        }
                    >
                        <i className='mdi mdi-refresh mdi-14px' /> Reload
                    </Dropdown.Item>
                </Dropdown>
            </span>
        </div>
    )
}

function highlight(value, search) {
    const text = String(value || '')
    const query = String(search || '').trim()
    if (!query || query.startsWith('#')) return text
    const index = text.toLowerCase().indexOf(query.toLowerCase())
    if (index < 0) return text
    return (
        <>
            {text.slice(0, index)}
            <mark>{text.slice(index, index + query.length)}</mark>
            {text.slice(index + query.length)}
        </>
    )
}

export default LayerRow
