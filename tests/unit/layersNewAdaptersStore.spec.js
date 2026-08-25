import { test, expect } from '@playwright/test'

const {
    normalizeFeatures,
    createExportAdapter,
} = require('../../plugins/core/tools/LayersNew/adapters/exportAdapter')
const {
    timestamp,
    createTimeAdapter,
} = require('../../plugins/core/tools/LayersNew/adapters/timeAdapter')
const {
    createLayersAdapter,
} = require('../../plugins/core/tools/LayersNew/adapters/layersAdapter')
const {
    createAttachmentsAdapter,
} = require('../../plugins/core/tools/LayersNew/adapters/attachmentsAdapter')
const {
    createLegendAdapter,
} = require('../../plugins/core/tools/LayersNew/adapters/legendAdapter')
const {
    initialLayersNewState,
    orderingHistoryString,
} = require('../../plugins/core/tools/LayersNew/store')

test.describe('LayersNew adapters', () => {
    test('normalizes feature payloads and delegates export conversion', () => {
        const converted = { converted: true }
        const adapter = createExportAdapter({
            layers: {
                layers: { on: { a: true }, data: { a: { name: 'a' } } },
            },
            api: { api: () => 'request' },
            convert: () => converted,
        })
        expect(normalizeFeatures({ Features: [1] })).toEqual({
            type: 'FeatureCollection',
            features: [1],
        })
        expect(adapter.isLayerOn('a')).toBe(true)
        expect(adapter.convertCoordinates({})).toBe(converted)
        expect(adapter.fetchGeodataset({ id: 'a' })).toBe('request')
    })

    test('delegates time, legend, attachment, and layer commands', () => {
        const calls = []
        const time = createTimeAdapter({
            timeUI: { updateTimes: (...args) => calls.push(['time', ...args]) },
        })
        expect(time.setGlobalFromExtent('2024-01-01', '2024-01-02')).toBe(true)
        expect(calls[0][0]).toBe('time')

        const legend = createLegendAdapter({
            legend: { refreshLegends: () => calls.push(['legend']) },
            derive: (layer) => layer.name,
            canDerive: () => true,
        })
        expect(legend.refresh({ name: 'a' })).toBe('a')
        expect(calls.some(([kind]) => kind === 'legend')).toBe(true)

        const attachmentLayers = {
            layers: { attachments: { a: { b: {} } } },
            toggleSublayer: (...args) => calls.push(['toggle', ...args]),
            setAttachmentVisibility: (...args) =>
                calls.push(['visibility', ...args]),
            setSublayerOpacity: (...args) => calls.push(['opacity', ...args]),
        }
        const attachments = createAttachmentsAdapter({
            layers: attachmentLayers,
            registry: {},
        })
        attachments.toggle('a', 'b')
        attachments.setVisibility('a', 'b', true)
        attachments.setOpacity('a', 'b', 0.5)
        expect(calls.map(([kind]) => kind)).toEqual(
            expect.arrayContaining(['toggle', 'visibility', 'opacity'])
        )
    })

    test('layer adapter delegates state-changing calls', async () => {
        const calls = []
        const fake = {
            layers: {
                data: { a: { name: 'a', type: 'vector' } },
                on: { a: false },
                layer: {},
                attachments: {},
            },
            asLayerUUID: (name) => name,
            getLayerOpacity: () => 0.5,
            toggleLayer: (layer) => calls.push(['toggle', layer.name]),
            setLayerOpacity: (...args) => calls.push(['opacity', ...args]),
            setLayerFilter: (...args) => calls.push(['filter', ...args]),
            setGlobalLoading: (name) => calls.push(['loading', name]),
            setGlobalLoaded: (name) => calls.push(['loaded', name]),
            reorderLayers: (names) => calls.push(['reorder', names]),
            subscribeOnLayerToggle: (...args) =>
                calls.push(['subscribe', ...args]),
            unsubscribeOnLayerToggle: (name) => calls.push(['unsubscribe', name]),
        }
        const adapter = createLayersAdapter({
            layers: fake,
            map: { orderedBringToFront: () => calls.push(['front']) },
            registry: { isStructural: () => false },
            filtering: {},
            formulae: {},
            globe: {},
            resetDynamicStyle: (...args) =>
                calls.push(['resetDynamicStyle', ...args]),
            restyleDynamicStyle: (...args) =>
                calls.push(['restyleDynamicStyle', ...args]),
            toast: {
                error: (...args) => calls.push(['error', ...args]),
                info: (...args) => calls.push(['info', ...args]),
            },
        })
        await adapter.toggleLayer('a')
        adapter.setOpacity('a', 0.4)
        adapter.reorder(['a'])
        expect(calls.map(([kind]) => kind)).toEqual([
            'toggle',
            'opacity',
            'reorder',
        ])

        const unsubscribe = adapter.subscribeOnLayerToggle(
            () => {},
            'LayersNewTree'
        )
        unsubscribe()
        expect(calls).toEqual(
            expect.arrayContaining([
                ['subscribe', 'LayersNewTree', expect.any(Function)],
                ['unsubscribe', 'LayersNewTree'],
            ])
        )
    })

    test('delegates reset, restyle, and error notification to real APIs', () => {
        const calls = []
        const adapter = createLayersAdapter({
            layers: {
                layers: { data: { a: { name: 'a' } } },
                asLayerUUID: (name) => name,
                getLayerOpacity: () => 1,
                setLayerOpacity: (...args) =>
                    calls.push(['opacity', ...args]),
                setLayerFilter: (...args) => calls.push(['filter', ...args]),
            },
            map: { orderedBringToFront: () => {} },
            globe: {},
            formulae: {},
            filtering: {},
            registry: {},
            resetDynamicStyle: (...args) =>
                calls.push(['resetDynamicStyle', ...args]),
            restyleDynamicStyle: (...args) =>
                calls.push(['restyleDynamicStyle', ...args]),
            toast: {
                error: (...args) => calls.push(['error', ...args]),
                info: (...args) => calls.push(['info', ...args]),
            },
        })

        const layer = { name: 'a' }
        adapter.resetSettings('a')
        adapter.restyle(layer)
        adapter.notify('error', 'Layer failed')

        expect(calls).toEqual([
            ['opacity', 'a', 1],
            ['filter', 'a', 'clear'],
            ['resetDynamicStyle', layer, null],
            ['restyleDynamicStyle', layer],
            ['error', 'Layer failed', 3000],
        ])
    })
})

test.describe('LayersNew store helpers', () => {
    test('contains reactive presentation state and serializes ordering history', () => {
        expect(initialLayersNewState).toEqual(
            expect.objectContaining({
                layerTree: [],
                layerState: {},
                loading: {},
                headerStates: {},
                search: '',
                typeFilters: [],
                selectedLayer: null,
                settingsPresentation: 'list',
            })
        )
        expect(
            orderingHistoryString([
                [1, 2, 0],
                [4, 5, 1],
            ])
        ).toBe('1-2-0.4-5-1')
        expect(timestamp('not-a-date')).toBeNull()
    })
})
