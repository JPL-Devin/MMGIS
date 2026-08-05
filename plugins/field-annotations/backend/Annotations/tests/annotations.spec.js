/**
 * Annotations backend — unit tests.
 * Run with `npm run test:plugins:unit`.
 */
const { test, expect } = require('@playwright/test')
const path = require('path')

const manifest = require(path.resolve(__dirname, '..', 'plugin.json'))
const setup = require(path.resolve(__dirname, '..', 'plugin.js'))
const { toFeatureCollection } = require(
    path.resolve(__dirname, '..', 'lib', 'geojson.js')
)

test('plugin.json is valid @unit', () => {
    expect(manifest.name).toBe('Annotations')
    expect(manifest.type).toBe('backend')
    expect(manifest.routes.prefix).toBe('/api/annotations')
})

test('lifecycle hooks are functions @unit', () => {
    for (const hook of ['onceInit', 'onceStarted', 'onceSynced'])
        expect(typeof setup[hook]).toBe('function')
})

test('onceInit mounts under ROOT_PATH behind an auth gate @unit', () => {
    const mounts = []
    const gate = () => 'gate'
    setup.onceInit({
        app: {
            use: (route, ...middleware) => mounts.push({ route, middleware }),
        },
        ROOT_PATH: '/root',
        ensureUser: gate,
        ensureAdmin: gate,
        checkHeadersCodeInjection: 'checkHeaders',
        setContentType: 'setContentType',
    })

    expect(mounts.length).toBe(1)
    expect(mounts[0].route).toBe('/root/api/annotations')
    expect(mounts[0].middleware).toContain('gate')
})

test('rows become a GeoJSON FeatureCollection @unit', () => {
    const fc = toFeatureCollection([
        {
            id: 1,
            lng: -4.5,
            lat: 12.25,
            note: 'outcrop',
            author: 'sci',
            mission: 'Test',
        },
    ])
    expect(fc.type).toBe('FeatureCollection')
    expect(fc.features[0].geometry.coordinates).toEqual([-4.5, 12.25])
    expect(fc.features[0].properties.note).toBe('outcrop')
    expect(toFeatureCollection(null).features).toEqual([])
})
