import React, { useState } from 'react'

import { Collapsible } from '@design/components'

class SectionBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { error: null }
    }

    static getDerivedStateFromError(error) {
        return { error }
    }

    render() {
        if (this.state.error)
            return (
                <div className='layersNewTool_sectionError'>
                    This section could not be loaded.
                </div>
            )
        return this.props.children
    }
}

function SectionHost({ section, layer, layerName, ctx }) {
    const Component = section.Component
    const [open, setOpen] = useState(section.defaultOpen !== false)
    if (section.id === 'reset')
        return (
            <div className='layersNewTool_settingsReset'>
                <Component
                    layer={layer}
                    layerName={layerName}
                    api={ctx.api}
                    ctx={ctx}
                />
            </div>
        )
    return (
        <SectionBoundary>
            <Collapsible open={open} onOpenChange={setOpen}>
                <Collapsible.Trigger className='layersNewTool_sectionTrigger'>
                    <i
                        className={`mdi mdi-chevron-right layersNewTool_sectionChevron ${
                            open ? 'is-open' : ''
                        }`}
                    />
                    <span>{section.label}</span>
                    {section.badge != null && (
                        <span className='layersNewTool_sectionBadge'>
                            {section.badge}
                        </span>
                    )}
                    {section.owner && (
                        <span
                            className={`layersNewTool_sectionOwner ${
                                section.owner !== 'core' ? 'is-type' : ''
                            }`}
                            style={
                                section.owner !== 'core'
                                    ? {
                                          '--layer-type-color': `var(--color-${section.owner}, var(--color-a4))`,
                                      }
                                    : undefined
                            }
                        >
                            {section.owner === 'core'
                                ? 'core'
                                : `${section.owner} layertype`}
                        </span>
                    )}
                </Collapsible.Trigger>
                <Collapsible.Content className='layersNewTool_sectionContent'>
                    <Component
                        layer={layer}
                        layerName={layerName}
                        api={ctx.api}
                        ctx={ctx}
                    />
                </Collapsible.Content>
            </Collapsible>
        </SectionBoundary>
    )
}

export default SectionHost
