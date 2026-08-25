import { test, expect } from '@playwright/test'

const {
    normalizeFeatures,
    createExportAdapter,
    exportOptions,
    exportFilename,
} = require('../../plugins/core/tools/LayersNew/adapters/exportAdapter')
const {
    timestamp,
    createTimeAdapter,
} = require('../../plugins/core/tools/LayersNew/adapters/timeAdapter')
const {
    createLayersAdapter,
    resolveLayerOpacity,
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
    test('resolves configured opacity when the runtime layer is absent', () => {
        const layers = {
            layers: {
                layer: {},
                opacity: { off: 0.65, missing: 'invalid' },
            },
            getLayerOpacity: () => 0,
        }
        expect(resolveLayerOpacity(layers, 'off')).toBe(0.65)
        expect(resolveLayerOpacity(layers, 'missing')).toBe(1)
    })

    test('normalizes feature payloads and delegates export conversion', () => {
        const converted = { converted: true }
        const adapter = createExportAdapter({
            layers: {
                layers: {
                    on: { a: true },
                    layer: { a: {} },
                    data: { a: { name: 'a' } },
                },
            },
            api: { api: () => 'request' },
            convert: () => converted,
        })
        expect(normalizeFeatures({ Features: [1] })).toEqual({
            type: 'FeatureCollection',
            features: [1],
        })
        expect(
            normalizeFeatures({
                type: 'FeatureCollection',
                Features: [2],
            })
        ).toEqual({
            type: 'FeatureCollection',
            features: [2],
        })
        expect(
            exportFilename({ display_name: 'Named layer' }, 'fallback')
        ).toBe('Named layer')
        expect(adapter.isLayerOn('a')).toBe(true)
        expect(adapter.convertCoordinates({})).toBe(converted)
        expect(adapter.fetchGeodataset({ id: 'a' })).toBe('request')
    })

    test('rejects export when configured on but runtime layer is absent', async () => {
        const warnings = []
        const adapter = createExportAdapter({
            layers: {
                layers: {
                    on: { a: true },
                    layer: {},
                    data: { a: { name: 'a', type: 'vector' } },
                },
            },
            api: { api: () => ({ Features: [] }) },
            toast: { warning: (message) => warnings.push(message) },
        })
        await expect(adapter.exportLayer('a')).rejects.toMatchObject({
            message: 'Please turn layer on before exporting.',
            toastHandled: true,
        })
        expect(warnings).toEqual(['Please turn layer on before exporting.'])
    })

    test('limits export scopes to dynamic extent capabilities', () => {
        expect(
            exportOptions({ type: 'vector' }).extents.map(
                (option) => option.value
            )
        ).toEqual(['local'])
        expect(
            exportOptions({
                type: 'vector',
                variables: {
                    dynamicExtent: true,
                    getFeaturePropertiesOnClick: true,
                },
                _lastGeodatasetRequestBody: { _source: ['properties'] },
            }).extents.map((option) => option.value)
        ).toEqual(['local', 'raw-extent', 'raw'])
        expect(exportOptions({ type: 'tile' }).formats).toEqual([])
    })

    test('rejects export when a layer is off', async () => {
        const warnings = []
        const adapter = createExportAdapter({
            layers: {
                layers: {
                    on: { a: false },
                    data: { a: { name: 'a', type: 'vector' } },
                },
            },
            api: { api: () => {} },
            convert: (value) => value,
            toast: { warning: (...args) => warnings.push(args) },
        })
        await expect(adapter.exportLayer('a')).rejects.toThrow(
            'Please turn layer on before exporting.'
        )
        expect(warnings[0][0]).toBe('Please turn layer on before exporting.')
    })

    test('exports current and raw feature data with coordinate conversion', async () => {
        const downloads = []
        const converted = []
        const layer = {
            name: 'a',
            type: 'vector',
            display_name: 'Export name',
            variables: { dynamicExtent: true },
            url: 'https://example.test/layer.json',
        }
        const adapter = createExportAdapter({
            layers: {
                GEOJSON_PRECISION: 6,
                layers: {
                    on: { a: true },
                    data: { a: layer },
                    layer: {
                        a: {
                            toGeoJSON: () => ({
                                Features: [{ type: 'Feature', geometry: null }],
                            }),
                        },
                    },
                },
                getUrl: () => layer.url,
            },
            api: {
                api: (endpoint, params, resolve) =>
                    resolve({
                        type: 'FeatureCollection',
                        features: [{ type: 'Feature', geometry: null }],
                    }),
            },
            convert: (value) => {
                converted.push(value)
                return { ...value, converted: true }
            },
            formulae: {
                downloadObject: (value, filename, extension) =>
                    downloads.push({ value, filename, extension }),
            },
        })
        await adapter.exportLayer('a', {
            format: 'geojson',
            extent: 'local',
            coords: 'primary',
        })
        expect(downloads[0]).toEqual(
            expect.objectContaining({
                filename: 'Export name',
                extension: '.geojson',
            })
        )
        expect(converted).toHaveLength(1)

        layer._lastGeodatasetRequestBody = {
            fields: ['name'],
            _source: ['properties'],
            noDuplicates: true,
        }
        await adapter.exportLayer('a', {
            format: 'geojson',
            extent: 'raw-extent',
        })
        expect(downloads).toHaveLength(2)
    })

    test('looks up the configured CRS before creating an SHP download', async () => {
        const calls = []
        const downloads = []
        const adapter = createExportAdapter({
            layers: {
                GEOJSON_PRECISION: 6,
                layers: {
                    on: { a: true },
                    data: {
                        a: {
                            name: 'a',
                            type: 'vector',
                            display_name: 'Shape',
                        },
                    },
                    layer: {
                        a: {
                            toGeoJSON: () => ({
                                type: 'FeatureCollection',
                                features: [],
                            }),
                        },
                    },
                },
            },
            api: {
                api: (endpoint, params, resolve) => {
                    calls.push([endpoint, params])
                    resolve('GEOGCS["WGS 84"]')
                },
            },
            convert: (value) => value,
            customCRS: { projString: '+proj=longlat +datum=WGS84' },
            saveAs: (content, filename) => downloads.push([content, filename]),
        })
        await adapter.exportLayer('a', { format: 'shp' })
        expect(calls).toEqual([
            ['proj42wkt', { proj4: '+proj=longlat +datum=WGS84' }],
        ])
        expect(downloads[0][1]).toBe('Shape.zip')
    })

    test('delegates time, legend, attachment, and layer commands', () => {
        const calls = []
        const notifications = []
        const time = createTimeAdapter({
            timeUI: { updateTimes: (...args) => calls.push(['time', ...args]) },
            toast: {
                error: (...args) => notifications.push(['error', ...args]),
                info: (...args) => notifications.push(['info', ...args]),
            },
        })
        expect(time.setGlobalFromExtent('2024-01-01', '2024-01-02')).toBe(true)
        expect(calls[0][0]).toBe('time')
        expect(notifications[0][1]).toBe(
            'Global time set to layer extent.'
        )
        expect(
            time.setGlobalFromExtent({ time: { dataStartTime: 'invalid' } })
        ).toBe(false)
        expect(notifications[1][1]).toBe(
            'Layer data extent not configured!'
        )

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
