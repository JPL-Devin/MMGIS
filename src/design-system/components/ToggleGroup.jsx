import React from 'react'
import * as BaseToggleGroup from '@base-ui-components/react/toggle-group'
import * as BaseToggle from '@base-ui-components/react/toggle'
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
        <BaseToggleGroup.Root className={cls} {...rest}>
            {children}
        </BaseToggleGroup.Root>
    )
}

function ToggleItem(props) {
    const { children, className = '', ...rest } = props
    return (
        <BaseToggle.Root className={`ds-toggle-item ${className}`} {...rest}>
            {children}
        </BaseToggle.Root>
    )
}

ToggleGroup.Item = ToggleItem
export default ToggleGroup
