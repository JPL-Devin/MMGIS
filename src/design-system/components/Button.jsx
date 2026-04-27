import React from 'react'
import { Button as BaseButton } from '@base-ui-components/react/button'
import './styles/Button.css'

const Button = React.forwardRef(function Button(props, ref) {
    const {
        variant = 'primary',
        size = 'small',
        active = false,
        icon = false,
        className = '',
        children,
        ...rest
    } = props

    const cls = [
        'ds-button',
        `ds-button--${variant}`,
        `ds-button--${size}`,
        active ? 'ds-button--active' : '',
        icon ? 'ds-button--icon' : '',
        className,
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <BaseButton ref={ref} className={cls} {...rest}>
            {children}
        </BaseButton>
    )
})

export default Button
