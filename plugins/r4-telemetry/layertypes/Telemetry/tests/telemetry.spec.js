/**
 * Telemetry layer type — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these). The
 * renderer is inherited from `vector` (`extends`), so there is nothing to
 * import there; the type's own logic is the pure time-window refilter in
 * lib/timeWindow.js, which is dependency-free and tested directly.
 */
import { test, expect } from '@playwright/test'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'
import {
    filterFeaturesByWindow,
    featureTime,
} from '../lib/timeWindow.js'

const manifest = manifestOf(__dirname)

const fc = (times) => ({
    type: 'FeatureCollection',
    features: times.map((t) => ({
        type: 'Feature',
        properties: t == null ? {} : { t },
        geometry: { type: 'Point', coordinates: [0, 0] },
    })),
})

test('plugin.json declares a valid layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('telemetry')
    // Telemetry inherits its renderers from the type it extends.
    expect(manifest.extends).toBe('vector')
    // Its own surface is `source`; the module must resolve.
    expect(manifest.modules.source).toBeDefined()
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('declares time support so core drives the refilter @unit', () => {
    expect(manifest.capabilities.time).toBeTruthy()
})

test('featureTime prefers endProp, falls back to startProp @unit', () => {
    const f = { properties: { a: '2020-01-02T00:00:00Z', b: '2020-01-03T00:00:00Z' } }
    expect(featureTime(f, 'a', 'b')).toBe(Date.parse('2020-01-03T00:00:00Z'))
    expect(featureTime({ properties: { a: '2020-01-02T00:00:00Z' } }, 'a', 'b')).toBe(
        Date.parse('2020-01-02T00:00:00Z')
    )
    expect(featureTime({ properties: {} }, 'a', 'b')).toBeNull()
})

test('filterFeaturesByWindow keeps only in-window features @unit', () => {
    const data = fc([
        '2020-01-01T00:00:00Z',
        '2020-01-05T00:00:00Z',
        '2020-01-10T00:00:00Z',
    ])
    const out = filterFeaturesByWindow(
        data,
        '2020-01-04T00:00:00Z',
        '2020-01-06T00:00:00Z',
        null,
        't'
    )
    expect(out.features).toHaveLength(1)
    expect(out.features[0].properties.t).toBe('2020-01-05T00:00:00Z')
})

test('features with no timestamp are kept; a bad window is a no-op @unit', () => {
    const data = fc(['2020-01-05T00:00:00Z', null])
    const windowed = filterFeaturesByWindow(
        data,
        '2020-01-01T00:00:00Z',
        '2020-01-02T00:00:00Z',
        null,
        't'
    )
    // The untimestamped feature survives an out-of-range window.
    expect(windowed.features).toHaveLength(1)
    expect(windowed.features[0].properties.t).toBeUndefined()

    const unparseable = filterFeaturesByWindow(data, 'nope', 'nope', null, 't')
    expect(unparseable.features).toHaveLength(2)
})
