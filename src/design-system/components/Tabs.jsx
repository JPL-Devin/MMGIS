import React from 'react'
import * as BaseTabs from '@base-ui-components/react/tabs'
import './styles/Tabs.css'

function Tabs(props) {
    const { children, className = '', ...rest } = props
    return (
        <BaseTabs.Root className={className} {...rest}>
            {children}
        </BaseTabs.Root>
    )
}

Tabs.List = function TabsList(props) {
    const { children, className = '', ...rest } = props
    return (
        <BaseTabs.List className={`ds-tabs-list ${className}`} {...rest}>
            {children}
        </BaseTabs.List>
    )
}

Tabs.Tab = function TabsTab(props) {
    const { children, className = '', ...rest } = props
    return (
        <BaseTabs.Tab className={`ds-tabs-tab ${className}`} {...rest}>
            {children}
        </BaseTabs.Tab>
    )
}

Tabs.Panel = function TabsPanel(props) {
    const { children, className = '', ...rest } = props
    return (
        <BaseTabs.Panel className={`ds-tabs-panel ${className}`} {...rest}>
            {children}
        </BaseTabs.Panel>
    )
}

export default Tabs
