import React from 'react'
import * as BaseSwitch from '@base-ui-components/react/switch'
import './styles/Switch.css'

function Switch(props) {
    const { label, className = '', ...rest } = props
    return (
        <BaseSwitch.Root className={`ds-switch ${className}`} {...rest}>
            <BaseSwitch.Thumb className="ds-switch-track">
                <span className="ds-switch-thumb" />
            </BaseSwitch.Thumb>
            {label && <span>{label}</span>}
        </BaseSwitch.Root>
    )
}

export default Switch
