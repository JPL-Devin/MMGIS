import React from 'react'
import * as BaseSlider from '@base-ui-components/react/slider'
import './styles/Slider.css'

function Slider(props) {
    const { className = '', ...rest } = props
    return (
        <BaseSlider.Root className={`ds-slider ${className}`} {...rest}>
            <BaseSlider.Control>
                <BaseSlider.Track className="ds-slider-track">
                    <BaseSlider.Indicator className="ds-slider-indicator" />
                    <BaseSlider.Thumb className="ds-slider-thumb" />
                </BaseSlider.Track>
            </BaseSlider.Control>
        </BaseSlider.Root>
    )
}

export default Slider
