import React from 'react'

import { useLayerTree } from '../hooks/useLayerTree'
import { useLayerVisibility } from '../hooks/useLayerVisibility'
import { useRefreshStatus } from '../hooks/useRefreshStatus'
import { useRestyled } from '../hooks/useRestyled'
import { IconButton } from '@design/components'

const LayersPanel = ({ onClose }) => {
    const rows = useLayerTree()
    useLayerVisibility()
    useRefreshStatus()
    useRestyled()

    return (
        <div className='layersNewTool'>
            <div className='mmgisToolHeader'>
                <div>
                    <div className='mmgisToolTitle'>LayersNew</div>
                    <div className='layersNewTool_count'>
                        {rows.length} layers
                    </div>
                </div>
                <IconButton size='sm' onClick={onClose} title='Close Tool'>
                    <i className='mdi mdi-close mdi-18px' />
                </IconButton>
            </div>
            <div className='layersNewTool_content'>
                Layer list will be rendered in the next phase.
            </div>
        </div>
    )
}

export default LayersPanel
