import { VideoSettingsSection } from '@basics/UserInterface_/LayerSettings'

const videoSettings = {
    sections: () => [
        {
            id: 'video-settings',
            label: 'Video controls',
            tab: 'settings',
            Component: VideoSettingsSection,
        },
    ],
}

export default videoSettings
