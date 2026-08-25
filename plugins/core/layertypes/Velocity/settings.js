import React from 'react'
import { RasterSettingsSection } from '@basics/UserInterface_/LayerSettings'
import { velocityRange } from '@basics/UserInterface_/LayerSettings/typeSettings'

const velocitySettings = {
    sections: () => [
        {
            id: 'velocity-settings',
            label: 'Velocity display',
            tab: 'settings',
            Component: ({ layer, api }) =>
                React.createElement(RasterSettingsSection, {
                    layer,
                    api,
                    adapterType: 'velocity',
                    fallback: 'binary',
                    hasCog: layer.kind === 'streamlines',
                    includeFilters: false,
                    normalizeRange: velocityRange,
                    resetLabel: 'color settings',
                }),
        },
    ],
}

export default velocitySettings
