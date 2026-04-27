import React from 'react'
import { ToggleGroup as BaseToggleGroup } from '@base-ui-components/react/toggle-group'
import { Toggle as BaseToggle } from '@base-ui-components/react/toggle'
import './styles/ToggleGroup.css'

function ToggleGroup(props) {
    const {
        variant = 'bordered',
        children,
        className = '',
        ...rest
    } = props

    const cls = [
        'ds-toggle-group',
        `ds-toggle-group--${variant}`,
        className,
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <BaseToggleGroup className={cls} {...rest}>
            {children}
        </BaseToggleGroup>
    )
}

function ToggleItem(props) {
    const { children, className = '', ...rest } = props
    return (
        <BaseToggle className={`ds-toggle-item ${className}`} {...rest}>
            {children}
        </BaseToggle>
    )
}

ToggleGroup.Item = ToggleItem
export default ToggleGroup
