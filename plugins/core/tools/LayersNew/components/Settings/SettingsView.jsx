import React, { useEffect } from 'react'

import { IconButton, Tabs } from '@design/components'
import SectionHost from './SectionHost'
import { useLayersNewStore } from '../../store'

function SettingsView({ settings, onBack }) {
    const { layer, layerName, ctx } = settings
    const settingsTab = useLayersNewStore((state) => state.settingsTab)
    const setSettingsTab = useLayersNewStore((state) => state.setSettingsTab)
    const [selectedTab, setSelectedTab] = React.useState(
        settings.tabs.some((tab) => tab.value === settingsTab)
            ? settingsTab
            : settings.tabs[0]?.value
    )

    useEffect(() => {
        if (settings.tabs.some((tab) => tab.value === settingsTab))
            setSelectedTab(settingsTab)
    }, [settings.tabs, settingsTab])

    const activeFilterCount =
        settings.ctx.api.getActiveFilterCount?.() || 0
    const attachmentCount = settings.ctx.api.getAttachmentCount?.() || 0
    const tabs = settings.tabs.map((tab) => ({
        ...tab,
        label: (
            <>
                {tab.label}
                {tab.value === 'filter' && activeFilterCount > 0 && (
                        <span className='layersNewTool_tabBadge'>
                            {activeFilterCount}
                        </span>
                    )}
                {tab.value === 'attachments' && attachmentCount > 0 && (
                        <span className='layersNewTool_tabBadge'>
                            {attachmentCount}
                        </span>
                    )}
            </>
        ),
    }))
    const children = tabs.map((tab) => {
        const sections = settings.sections
            .filter((section) => (section.tab || 'settings') === tab.value)
            .sort((a, b) => (a.order || 0) - (b.order || 0))
        return (
            <React.Fragment key={tab.value}>
                {sections
                    .filter((section) => section.id !== 'reset')
                    .map((section) => (
                        <SectionHost
                            key={section.id}
                            section={section}
                            layer={layer}
                            layerName={layerName}
                            ctx={ctx}
                        />
                    ))}
                {sections
                    .filter((section) => section.id === 'reset')
                    .map((section) => (
                        <SectionHost
                            key={section.id}
                            section={section}
                            layer={layer}
                            layerName={layerName}
                            ctx={ctx}
                        />
                    ))}
            </React.Fragment>
        )
    })

    return (
        <div className='layersNewTool_settingsView'>
            <div className='layersNewTool_settingsHeader'>
                <IconButton
                    size='sm'
                    aria-label='Back to layers'
                    onClick={onBack}
                >
                    <i className='mdi mdi-arrow-left mdi-18px' />
                </IconButton>
                <span
                    className='layersNewTool_settingsColor'
                    style={{
                        '--layer-type-color': `var(--color-${layer.type}, var(--color-a4))`,
                    }}
                />
                <div>
                    {settings.parentPath?.length > 0 && (
                        <div className='layersNewTool_settingsBreadcrumb'>
                            {settings.parentPath.join(' / ')}
                        </div>
                    )}
                    <h2>{layer.display_name || layerName}</h2>
                    {settings.summary && (
                        <div className='layersNewTool_settingsSummary'>
                            {settings.summary}
                        </div>
                    )}
                </div>
                <span
                    className='layersNewTool_settingsType'
                    style={{
                        '--layer-type-color': `var(--color-${layer.type}, var(--color-a4))`,
                    }}
                >
                    {layer.type}
                </span>
                <IconButton
                    size='sm'
                    className='layersNewTool_settingsReload'
                    aria-label='Reload layer'
                    title='Reload layer'
                    onClick={() => settings.ctx.api.refreshLayer()}
                >
                    <i className='mdi mdi-refresh mdi-16px' />
                </IconButton>
            </div>
            <Tabs
                size='sm'
                value={selectedTab}
                onValueChange={(value) => {
                    setSelectedTab(value)
                    setSettingsTab(value)
                }}
                tabs={tabs}
            >
                {children}
            </Tabs>
        </div>
    )
}

export default SettingsView
