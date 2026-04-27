import React from 'react'
import * as BaseTooltip from '@base-ui-components/react/tooltip'
import './styles/Tooltip.css'

function Tooltip(props) {
    const { content, placement = 'right', children, delay = 300, className = '' } = props
    return (
        <BaseTooltip.Provider>
            <BaseTooltip.Root delay={delay}>
                <BaseTooltip.Trigger render={children} />
                <BaseTooltip.Portal>
                    <BaseTooltip.Positioner side={placement}>
                        <BaseTooltip.Popup className={`ds-tooltip-popup ${className}`}>
                            {content}
                        </BaseTooltip.Popup>
                    </BaseTooltip.Positioner>
                </BaseTooltip.Portal>
            </BaseTooltip.Root>
        </BaseTooltip.Provider>
    )
}

export default Tooltip
