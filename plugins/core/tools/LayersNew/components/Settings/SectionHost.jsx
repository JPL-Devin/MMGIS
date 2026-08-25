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
    return (
        <SectionBoundary>
            <Collapsible open={open} onOpenChange={setOpen}>
                <Collapsible.Trigger>
                    <span>{section.label}</span>
                    {section.badge != null && <span>{section.badge}</span>}
                </Collapsible.Trigger>
                <Collapsible.Content>
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
