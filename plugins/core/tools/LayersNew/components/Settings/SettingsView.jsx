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
        ctx.api.ensureOn()
    }, [ctx.api])
    useEffect(() => {
        if (settings.tabs.some((tab) => tab.value === settingsTab))
            setSelectedTab(settingsTab)
    }, [settings.tabs, settingsTab])

    const tabs = settings.tabs
    const children = tabs.map((tab) =>
        settings.sections
            .filter((section) => (section.tab || 'settings') === tab.value)
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map((section) => (
                <SectionHost
                    key={section.id}
                    section={section}
                    layer={layer}
                    layerName={layerName}
                    ctx={ctx}
                />
            ))
    )

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
                    <h2>{layer.display_name || layerName}</h2>
                    {settings.summary && (
                        <div className='layersNewTool_settingsSummary'>
                            {settings.summary}
                        </div>
                    )}
                </div>
            </div>
            <Tabs
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
