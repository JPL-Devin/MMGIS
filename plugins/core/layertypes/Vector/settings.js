import {
    CompositeLayersSection,
    DynamicStyleSection,
    StatisticsSection,
} from '@basics/UserInterface_/LayerSettings'

const vectorSettings = {
    sections: () => [
        {
            id: 'dynamic-style',
            label: 'Dynamic Style',
            tab: 'settings',
            Component: DynamicStyleSection,
        },
        {
            id: 'statistics',
            label: 'Statistics',
            tab: 'settings',
            Component: StatisticsSection,
        },
        {
            id: 'attachments',
            label: 'Composite Layers',
            tab: 'attachments',
            Component: CompositeLayersSection,
        },
    ],
}

export default vectorSettings
