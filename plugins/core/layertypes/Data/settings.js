import React from 'react'
import { DataShaderSection, RasterSettingsSection } from '@basics/UserInterface_/LayerSettings'

const dataSettings = {
    sections: () => [
        {
            id: 'data-shader',
            label: 'Data shader',
            tab: 'settings',
            Component: DataShaderSection,
        },
        {
            id: 'data-display',
            label: 'Data display',
            tab: 'settings',
            Component: ({ layer, api }) =>
                React.createElement(RasterSettingsSection, {
                    layer,
                    api,
                    adapterType: 'tile',
                    fallback: 'viridis',
                    hasCog:
                        layer.cogTransform === true &&
                        typeof layer.url === 'string',
                    includeFilters: true,
                    includeBlend: true,
                    allowExpression: true,
                    discoverStac: true,
                }),
        },
    ],
}

export default dataSettings
