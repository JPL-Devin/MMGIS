import React from 'react'
import './styles/Spinner.css'

function Spinner(props) {
    const { size = 'medium', className = '' } = props
    return (
        <div
            className={`ds-spinner ds-spinner--${size} ${className}`}
            role="status"
            aria-label="Loading"
        />
    )
}

export default Spinner
