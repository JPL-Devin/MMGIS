import React from 'react'
import * as BaseCheckbox from '@base-ui-components/react/checkbox'
import './styles/Checkbox.css'

function Checkbox(props) {
    const { label, className = '', ...rest } = props
    return (
        <BaseCheckbox.Root className={`ds-checkbox ${className}`} {...rest}>
            <BaseCheckbox.Indicator className="ds-checkbox-indicator">
                <CheckIcon />
            </BaseCheckbox.Indicator>
            {label && <span>{label}</span>}
        </BaseCheckbox.Root>
    )
}

function CheckIcon() {
    return (
        <svg viewBox="0 0 12 12" fill="none">
            <path
                d="M10 3L4.5 8.5L2 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}

export default Checkbox
