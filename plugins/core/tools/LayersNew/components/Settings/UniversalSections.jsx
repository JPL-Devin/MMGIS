import React from 'react'

import { Checkbox, IconButton, Slider, Tooltip } from '@design/components'
import FilterMount from './FilterMount'

function OpacitySection({ api }) {
    const value = api.opacity()
    return (
        <div className='layersNewTool_settingControl'>
            <Slider
                value={[value]}
                min={0}
                max={1}
                step={0.01}
                suffix='%'
                formatValue={(current) =>
                    Math.round(Number(current?.[0] || 0) * 100)
                }
                onValueChange={(next) => api.setOpacity(next[0])}
            />
        </div>
    )
}

function FilterSection({ layerName, adapters }) {
    return (
        <FilterMount adapter={adapters.layers} layerName={layerName} />
    )
}

function AttachmentsSection({ layerName, adapters }) {
    const attachments = adapters.attachments.getAttachments(layerName)
    return (
        <div className='layersNewTool_attachments'>
            {Object.entries(attachments)
                .filter(([, attachment]) => attachment !== false)
                .map(([key, attachment]) => {
                    const title =
                        attachment.title ||
                        adapters.attachments.describe(
                            adapters.attachments.idForSublayerKey(key)
                        ).description
                    return (
                        <div className='layersNewTool_attachment' key={key}>
                            <span>{title}</span>
                            <div>
                                {attachment.opacity != null && (
                                    <Slider
                                        value={[attachment.opacity]}
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        onValueChange={(next) =>
                                            adapters.attachments.setOpacity(
                                                layerName,
                                                key,
                                                next[0]
                                            )
                                        }
                                    />
                                )}
                                <Checkbox
                                    checked={attachment.on === true}
                                    onCheckedChange={(checked) =>
                                        adapters.attachments.setVisibility(
                                            layerName,
                                            key,
                                            checked
                                        )
                                    }
                                    aria-label={`Toggle ${title}`}
                                />
                            </div>
                        </div>
                    )
                })}
        </div>
    )
}

function TimeSection({ layer, adapters }) {
    const time = adapters.time.getData(layer)
    const setExtent = () => adapters.time.setGlobalFromExtent(layer)
    return (
        <div className='layersNewTool_timeSection'>
            {(time.dataStartTime || time.dataEndTime) && (
                <div className='layersNewTool_timeExtent'>
                    <div className='layersNewTool_settingHeading'>
                        <span>Data Time Extent</span>
                        <Tooltip content='Set global time to data extent'>
                            <IconButton
                                size='sm'
                                aria-label='Set global time to data extent'
                                onClick={setExtent}
                            >
                                <i className='mdi mdi-crosshairs-gps mdi-16px' />
                            </IconButton>
                        </Tooltip>
                    </div>
                    <div>Data Start Time</div>
                    <strong>{time.dataStartTime || 'Not Set'}</strong>
                    <div>Data End Time</div>
                    <strong>{time.dataEndTime || 'Not Set'}</strong>
                </div>
            )}
            {time.refreshIntervalEnabled === true && (
                <div>
                    <div>Auto-Refreshes Every</div>
                    <strong>
                        {time.refreshIntervalAmount || 60} Seconds
                    </strong>
                </div>
            )}
        </div>
    )
}

function ResetSection({ api }) {
    return (
        <Tooltip content='Reset all layer settings'>
            <IconButton
                size='sm'
                aria-label='Reset all layer settings'
                className='layersNewTool_reset'
                onClick={() => api.resetSettings()}
            >
                <i className='mdi mdi-restore mdi-18px' />
            </IconButton>
        </Tooltip>
    )
}

export function universalSections(layer, layerName, adapters) {
    const sections = [
        {
            id: 'opacity',
            label: 'Opacity',
            tab: 'settings',
            Component: OpacitySection,
        },
        {
            id: 'filter',
            label: 'Filtering',
            tab: 'filter',
            Component: () => (
                <FilterSection layerName={layerName} adapters={adapters} />
            ),
            hidden: !adapters.layers.isFilterable(layerName),
        },
        {
            id: 'attachments',
            label: 'Attachments',
            tab: 'attachments',
            Component: () => (
                <AttachmentsSection
                    layerName={layerName}
                    adapters={adapters}
                />
            ),
            hidden: Object.keys(
                adapters.attachments.getAttachments(layerName)
            ).length === 0,
        },
        {
            id: 'time',
            label: 'Time',
            tab: 'time',
            Component: () => <TimeSection layer={layer} adapters={adapters} />,
            hidden: layer.time?.enabled !== true,
        },
        {
            id: 'reset',
            label: 'Reset',
            tab: 'settings',
            Component: ({ api }) => <ResetSection api={api} />,
        },
    ]
    return sections
}
