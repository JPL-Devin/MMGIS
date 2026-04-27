import React from 'react'
import { Input as BaseInput } from '@base-ui-components/react/input'
import './styles/Input.css'

const Input = React.forwardRef(function Input(props, ref) {
    const { search = false, size = 'small', className = '', ...rest } = props
    const cls = [
        'ds-input',
        search ? 'ds-input--search' : '',
        size === 'medium' ? 'ds-input--medium' : '',
        className,
    ]
        .filter(Boolean)
        .join(' ')

    return <BaseInput ref={ref} className={cls} {...rest} />
})

export default Input
