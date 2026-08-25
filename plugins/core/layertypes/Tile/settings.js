import React from 'react'
import { RasterSettingsSection } from '@basics/UserInterface_/LayerSettings'

function TileRasterSettings({ layer, api }) {
    return React.createElement(RasterSettingsSection, {
        layer,
        api,
        adapterType: 'tile',
        fallback: 'viridis',
        hasCog: layer.cogTransform === true && typeof layer.url === 'string',
        includeFilters: true,
        includeBlend: true,
        allowExpression: true,
        discoverStac: true,
    })
}

const tileSettings = {
    sections: () => [
        {
            id: 'tile-settings',
            label: 'Tile display',
            tab: 'settings',
            Component: TileRasterSettings,
        },
    ],
}

export default tileSettings
