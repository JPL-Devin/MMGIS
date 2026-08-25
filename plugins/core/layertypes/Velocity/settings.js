import React from 'react'
import { RasterSettingsSection } from '@basics/UserInterface_/LayerSettings'

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
                    type: 'velocity',
                }),
        },
    ],
}

export default velocitySettings
