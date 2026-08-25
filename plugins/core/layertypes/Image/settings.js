import React from 'react'
import { RasterSettingsSection } from '@basics/UserInterface_/LayerSettings'

const imageSettings = {
    sections: () => [
        {
            id: 'image-settings',
            label: 'Image display',
            tab: 'settings',
            Component: ({ layer, api }) =>
                React.createElement(RasterSettingsSection, {
                    layer,
                    api,
                    adapterType: 'image',
                    fallback: 'binary',
                    hasCog:
                        layer.cogTransform === true &&
                        typeof layer.url === 'string',
                    includeFilters: true,
                    allowExpression: true,
                }),
        },
    ],
}

export default imageSettings
