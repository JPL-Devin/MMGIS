import { RasterSettingsSection } from '@basics/UserInterface_/LayerSettings'

const tileSettings = {
    sections: () => [
        {
            id: 'tile-settings',
            label: 'Tile display',
            tab: 'settings',
            Component: RasterSettingsSection,
        },
    ],
}

export default tileSettings
